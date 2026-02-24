import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { gcloud, gcloudWithSpinner, run } from "../utils/shell.js";
import { generateStartupScript } from "../templates/startup-script.js";
import { PLUGIN_REGISTRY } from "../config/plugins.js";
import { SKILL_REGISTRY } from "../config/skills.js";
export class GcpDeployer {
    config;
    get project() {
        return this.config.gcp.projectId;
    }
    get zone() {
        return this.config.gcp.zone;
    }
    get vmName() {
        return this.config.gcp.vmName;
    }
    async deploy(config) {
        this.config = config;
        const saEmail = `openclaw-sa@${this.project}.iam.gserviceaccount.com`;
        console.log(chalk.bold("\n  Starting deployment...\n"));
        await this.enableApis();
        await this.ensureServiceAccount(saEmail);
        await this.storeSecrets();
        await this.configureFirewall();
        const startupFile = await this.writeStartupScript();
        await this.createVm(saEmail, startupFile);
        await unlink(startupFile);
        await this.waitForStartup();
        await this.installPlugins();
        await this.configurePlugins();
        await this.installSkills();
        await this.verifyHealth();
        console.log(chalk.bold.green("\n  ✓ Deployment complete!\n"));
        console.log("  Next steps:");
        console.log(`    1. Check status:  gcloud compute ssh ${this.vmName} --zone=${this.zone} -- openclaw status`);
        console.log(`    2. SSH tunnel:    gcloud compute ssh ${this.vmName} --zone=${this.zone} -- -L 18789:localhost:18789`);
        console.log(`    3. Pair Telegram: openclaw pairing approve telegram <CODE>\n`);
    }
    dryRun(config) {
        this.config = config;
        const saEmail = `openclaw-sa@${this.project}.iam.gserviceaccount.com`;
        console.log(chalk.bold("\n  Dry Run — Commands that would be executed:\n"));
        console.log(chalk.dim("  # Enable APIs"));
        console.log(`  gcloud services enable compute.googleapis.com secretmanager.googleapis.com drive.googleapis.com --project=${this.project}\n`);
        console.log(chalk.dim("  # Service Account"));
        console.log(`  gcloud iam service-accounts create openclaw-sa --display-name="OpenClaw SA" --project=${this.project}`);
        console.log(`  gcloud projects add-iam-policy-binding ${this.project} --member=serviceAccount:${saEmail} --role=roles/secretmanager.secretAccessor\n`);
        console.log(chalk.dim("  # Secrets"));
        for (const secretName of Object.keys(config.apiKeys)) {
            console.log(`  gcloud secrets create ${secretName} --project=${this.project}`);
        }
        console.log();
        console.log(chalk.dim("  # Firewall"));
        console.log(`  gcloud compute firewall-rules create allow-iap-ssh --project=${this.project} --rules=tcp:22 --source-ranges=35.235.240.0/20`);
        console.log(`  gcloud compute firewall-rules create deny-all-ingress --project=${this.project} --action=DENY --rules=all\n`);
        console.log(chalk.dim("  # VM"));
        console.log(`  gcloud compute instances create ${this.vmName} --zone=${this.zone} --machine-type=${config.gcp.machineType} --image-family=debian-12 --no-address\n`);
        const enabledPlugins = Object.entries(config.plugins)
            .filter(([, v]) => v)
            .map(([k]) => k);
        console.log(chalk.dim("  # Plugins"));
        for (const p of enabledPlugins) {
            console.log(`  gcloud compute scp plugins/${p}/* ${this.vmName}:/tmp/${p}-plugin/`);
        }
        console.log();
        const enabledSkills = Object.entries(config.skills)
            .filter(([, v]) => v)
            .map(([k]) => k);
        console.log(chalk.dim("  # Skills"));
        for (const s of enabledSkills) {
            const meta = SKILL_REGISTRY.find((sk) => sk.id === s);
            if (meta?.cron) {
                console.log(`  openclaw cron add --name '${s}' --cron '${meta.cron}' --message '/${s}'`);
            }
        }
        console.log(chalk.dim("\n  # Startup Script (generated):"));
        const script = generateStartupScript(config);
        console.log(chalk.dim(script
            .split("\n")
            .map((l) => `  ${l}`)
            .join("\n")));
    }
    // ── Deploy Steps ──────────────────────────────────────────────────
    async enableApis() {
        await gcloudWithSpinner("Enabling GCP APIs", [
            "services",
            "enable",
            "compute.googleapis.com",
            "secretmanager.googleapis.com",
            "drive.googleapis.com",
            `--project=${this.project}`,
        ]);
    }
    async ensureServiceAccount(saEmail) {
        const check = await gcloud([
            "iam",
            "service-accounts",
            "describe",
            saEmail,
            `--project=${this.project}`,
        ]);
        if (check.exitCode !== 0) {
            await gcloudWithSpinner("Creating service account", [
                "iam",
                "service-accounts",
                "create",
                "openclaw-sa",
                '--display-name=OpenClaw SA',
                `--project=${this.project}`,
            ]);
            // Wait for IAM propagation
            await new Promise((r) => setTimeout(r, 10_000));
        }
        else {
            console.log(chalk.green("  ✓ Service account already exists"));
        }
        await gcloudWithSpinner("Granting Secret Manager access", [
            "projects",
            "add-iam-policy-binding",
            this.project,
            `--member=serviceAccount:${saEmail}`,
            "--role=roles/secretmanager.secretAccessor",
            "--quiet",
        ]);
    }
    async storeSecrets() {
        const spinner = ora("Storing secrets in Secret Manager").start();
        let stored = 0;
        for (const [secretName, value] of Object.entries(this.config.apiKeys)) {
            // Create secret (ignore if exists)
            await gcloud([
                "secrets",
                "create",
                secretName,
                `--project=${this.project}`,
                "--replication-policy=automatic",
            ]);
            // Add version with the value
            const tmpFile = join(tmpdir(), `secret-${secretName}-${Date.now()}`);
            await writeFile(tmpFile, value);
            await gcloud([
                "secrets",
                "versions",
                "add",
                secretName,
                `--data-file=${tmpFile}`,
                `--project=${this.project}`,
            ]);
            await unlink(tmpFile);
            stored++;
        }
        spinner.succeed(`Stored ${stored} secrets in Secret Manager`);
    }
    async configureFirewall() {
        // Allow SSH from IAP
        const iapCheck = await gcloud([
            "compute",
            "firewall-rules",
            "describe",
            "allow-iap-ssh",
            `--project=${this.project}`,
        ]);
        if (iapCheck.exitCode !== 0) {
            await gcloudWithSpinner("Creating IAP SSH firewall rule", [
                "compute",
                "firewall-rules",
                "create",
                "allow-iap-ssh",
                `--project=${this.project}`,
                "--direction=INGRESS",
                "--priority=1000",
                "--network=default",
                "--action=ALLOW",
                "--rules=tcp:22",
                "--source-ranges=35.235.240.0/20",
                "--target-tags=openclaw",
            ]);
        }
        else {
            console.log(chalk.green("  ✓ IAP SSH firewall rule exists"));
        }
        // Deny all other ingress
        const denyCheck = await gcloud([
            "compute",
            "firewall-rules",
            "describe",
            "deny-all-ingress",
            `--project=${this.project}`,
        ]);
        if (denyCheck.exitCode !== 0) {
            await gcloudWithSpinner("Creating deny-all firewall rule", [
                "compute",
                "firewall-rules",
                "create",
                "deny-all-ingress",
                `--project=${this.project}`,
                "--direction=INGRESS",
                "--priority=2000",
                "--network=default",
                "--action=DENY",
                "--rules=all",
                "--source-ranges=0.0.0.0/0",
                "--target-tags=openclaw",
            ]);
        }
        else {
            console.log(chalk.green("  ✓ Deny-all firewall rule exists"));
        }
    }
    async writeStartupScript() {
        const script = generateStartupScript(this.config);
        const tmpFile = join(tmpdir(), `openclaw-startup-${Date.now()}.sh`);
        await writeFile(tmpFile, script);
        return tmpFile;
    }
    async createVm(saEmail, startupFile) {
        const vmCheck = await gcloud([
            "compute",
            "instances",
            "describe",
            this.vmName,
            `--zone=${this.zone}`,
            `--project=${this.project}`,
        ]);
        if (vmCheck.exitCode === 0) {
            console.log(chalk.yellow("  VM already exists — updating startup script..."));
            await gcloudWithSpinner("Updating VM metadata", [
                "compute",
                "instances",
                "add-metadata",
                this.vmName,
                `--zone=${this.zone}`,
                `--project=${this.project}`,
                `--metadata-from-file=startup-script=${startupFile}`,
            ]);
            await gcloudWithSpinner("Resetting VM", [
                "compute",
                "instances",
                "reset",
                this.vmName,
                `--zone=${this.zone}`,
                `--project=${this.project}`,
            ]);
        }
        else {
            await gcloudWithSpinner("Creating VM", [
                "compute",
                "instances",
                "create",
                this.vmName,
                `--zone=${this.zone}`,
                `--project=${this.project}`,
                `--machine-type=${this.config.gcp.machineType}`,
                "--image-family=debian-12",
                "--image-project=debian-cloud",
                `--service-account=${saEmail}`,
                "--scopes=cloud-platform",
                "--tags=openclaw",
                `--metadata-from-file=startup-script=${startupFile}`,
                "--no-address",
            ]);
        }
    }
    async waitForStartup() {
        const spinner = ora("Waiting for VM startup script to complete (~90s)").start();
        await new Promise((r) => setTimeout(r, 90_000));
        spinner.succeed("VM startup script completed");
    }
    async installPlugins() {
        const enabledPlugins = Object.entries(this.config.plugins)
            .filter(([, v]) => v)
            .map(([k]) => k);
        for (const pluginId of enabledPlugins) {
            const spinner = ora(`Installing plugin: ${pluginId}`).start();
            const pluginDest = `/root/.openclaw/extensions/${pluginId}`;
            const tmpDest = `/tmp/${pluginId}-plugin`;
            // Create directories
            await gcloud([
                "compute",
                "ssh",
                this.vmName,
                `--zone=${this.zone}`,
                `--project=${this.project}`,
                "--",
                `sudo mkdir -p ${pluginDest} && mkdir -p ${tmpDest}`,
            ]);
            // SCP plugin files — use bundled plugin-files directory
            const pluginSrc = this.getPluginSourcePath(pluginId);
            await gcloud([
                "compute",
                "scp",
                `${pluginSrc}/package.json`,
                `${pluginSrc}/index.ts`,
                `${pluginSrc}/openclaw.plugin.json`,
                `${this.vmName}:${tmpDest}/`,
                `--zone=${this.zone}`,
                `--project=${this.project}`,
            ]);
            // Copy to destination and install deps
            await gcloud([
                "compute",
                "ssh",
                this.vmName,
                `--zone=${this.zone}`,
                `--project=${this.project}`,
                "--",
                `sudo cp ${tmpDest}/* ${pluginDest}/ && sudo bash -c 'cd ${pluginDest} && npm install --omit=dev'`,
            ]);
            spinner.succeed(`Installed plugin: ${pluginId}`);
        }
    }
    async configurePlugins() {
        const spinner = ora("Configuring plugins").start();
        const enabledPlugins = Object.entries(this.config.plugins)
            .filter(([, v]) => v)
            .map(([k]) => k);
        // Build plugin config entries
        const pluginEntries = {};
        for (const pluginId of enabledPlugins) {
            const pluginMeta = PLUGIN_REGISTRY.find((p) => p.id === pluginId);
            if (!pluginMeta)
                continue;
            const pluginConfig = {};
            // Map API keys to plugin config properties
            for (const key of [...pluginMeta.requiredKeys, ...pluginMeta.optionalKeys]) {
                const secretValue = this.config.apiKeys[key.secretName];
                if (secretValue) {
                    pluginConfig[key.key] = secretValue;
                }
            }
            // Special handling: convex-knowledge uses convex-url
            if (pluginId === "convex-knowledge" && this.config.apiKeys["convex-url"]) {
                pluginConfig["convexUrl"] = this.config.apiKeys["convex-url"];
            }
            // Drive OAuth tokens for media plugins
            if ((pluginId === "image-gen" || pluginId === "video-gen") &&
                this.config.apiKeys["convex-url"]) {
                pluginConfig["convexUrl"] = this.config.apiKeys["convex-url"];
            }
            if (this.config.apiKeys["drive-media-folder-id"]) {
                if (pluginId === "image-gen" || pluginId === "video-gen") {
                    pluginConfig["driveFolderId"] = this.config.apiKeys["drive-media-folder-id"];
                    if (this.config.apiKeys["drive-oauth-client-id"]) {
                        pluginConfig["driveClientId"] = this.config.apiKeys["drive-oauth-client-id"];
                    }
                    if (this.config.apiKeys["drive-oauth-client-secret"]) {
                        pluginConfig["driveClientSecret"] = this.config.apiKeys["drive-oauth-client-secret"];
                    }
                    if (this.config.apiKeys["drive-oauth-refresh-token"]) {
                        pluginConfig["driveRefreshToken"] = this.config.apiKeys["drive-oauth-refresh-token"];
                    }
                }
            }
            pluginEntries[pluginId] = { enabled: true, config: pluginConfig };
        }
        // Build the Node.js patch script
        const entriesJson = JSON.stringify(pluginEntries, null, 2);
        const patchScript = `
const fs = require("fs");
const configPath = "/root/.openclaw/openclaw.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.plugins = config.plugins || {};
config.plugins.entries = Object.assign(config.plugins.entries || {}, ${entriesJson});
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("Plugin configs written successfully");
`.trim();
        await gcloud([
            "compute",
            "ssh",
            this.vmName,
            `--zone=${this.zone}`,
            `--project=${this.project}`,
            "--",
            `sudo node -e '${patchScript.replace(/'/g, "'\\''")}'`,
        ]);
        // Restart OpenClaw to pick up config
        await gcloud([
            "compute",
            "ssh",
            this.vmName,
            `--zone=${this.zone}`,
            `--project=${this.project}`,
            "--",
            "sudo systemctl restart openclaw",
        ]);
        spinner.succeed("Plugins configured");
    }
    async installSkills() {
        const enabledSkills = Object.entries(this.config.skills)
            .filter(([, v]) => v)
            .map(([k]) => k);
        if (enabledSkills.length === 0)
            return;
        const spinner = ora("Installing skills").start();
        // Create tarball of skill files
        const tmpDir = await mkdtemp(join(tmpdir(), "claw-skills-"));
        const tarball = join(tmpDir, "skills.tar.gz");
        const skillPaths = enabledSkills.map((s) => `${s}/SKILL.md`);
        const skillsRoot = this.getSkillsSourcePath();
        await run("tar", ["-czf", tarball, "-C", skillsRoot, ...skillPaths]);
        // SCP and extract
        await gcloud([
            "compute",
            "scp",
            tarball,
            `${this.vmName}:/tmp/skills.tar.gz`,
            `--zone=${this.zone}`,
            `--project=${this.project}`,
        ]);
        const skillsDest = "/root/.openclaw/skills";
        const cronCommands = enabledSkills
            .map((s) => {
            const meta = SKILL_REGISTRY.find((sk) => sk.id === s);
            if (!meta?.cron)
                return "";
            return `sudo openclaw cron add --name '${s}' --cron '${meta.cron}' --message '/${s}' || echo 'Cron may exist'`;
        })
            .filter(Boolean)
            .join("; ");
        await gcloud([
            "compute",
            "ssh",
            this.vmName,
            `--zone=${this.zone}`,
            `--project=${this.project}`,
            "--",
            `sudo mkdir -p ${skillsDest} && sudo tar -xzf /tmp/skills.tar.gz -C ${skillsDest} && rm -f /tmp/skills.tar.gz${cronCommands ? `; ${cronCommands}` : ""}`,
        ]);
        // Cleanup local temp
        await unlink(tarball);
        spinner.succeed(`Installed ${enabledSkills.length} skills`);
    }
    async verifyHealth() {
        const spinner = ora("Verifying deployment health").start();
        const result = await gcloud([
            "compute",
            "ssh",
            this.vmName,
            `--zone=${this.zone}`,
            `--project=${this.project}`,
            "--",
            "sudo systemctl is-active openclaw",
        ]);
        if (result.stdout.trim() === "active") {
            spinner.succeed("OpenClaw is running");
        }
        else {
            spinner.warn("OpenClaw service status: " + result.stdout.trim());
        }
    }
    getPluginSourcePath(pluginId) {
        return join(this.getPackageRoot(), "plugin-files", pluginId);
    }
    getSkillsSourcePath() {
        return join(this.getPackageRoot(), "skill-files");
    }
    getPackageRoot() {
        // Walk up from dist/deployers/ to package root
        const filePath = new URL(import.meta.url).pathname;
        // dist/deployers/gcp.js -> package root (3 levels up)
        return join(filePath, "..", "..", "..");
    }
}
//# sourceMappingURL=gcp.js.map