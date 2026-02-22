import chalk from "chalk";
import { welcomeStep } from "./welcome.js";
import { cloudProviderStep } from "./cloud-provider.js";
import { gcpProjectStep } from "./gcp-project.js";
import { whiteLabelStep } from "./white-label.js";
import { pluginsStep } from "./plugins.js";
import { skillsStep } from "./skills.js";
import { channelStep } from "./channel.js";
import { apiKeysStep } from "./api-keys.js";
import { confirmStep } from "./confirm.js";
import { googleDriveOAuthFlow } from "../oauth/google-drive.js";
import { GcpDeployer } from "../deployers/gcp.js";
export async function runWizard(options = {}) {
    try {
        // Step 1: Welcome + Prerequisites
        await welcomeStep();
        // Step 2: Cloud Provider
        const cloudProvider = await cloudProviderStep();
        // Step 3: GCP Project Setup
        const gcpConfig = await gcpProjectStep();
        // Step 4: Preset / White-Label
        const { preset, branding } = await whiteLabelStep(options.preset);
        // Step 5: Plugin Selection
        const enabledPluginIds = await pluginsStep(preset?.plugins);
        const plugins = {};
        for (const id of enabledPluginIds) {
            plugins[id] = true;
        }
        // Step 6: Skill Selection
        const enabledSkillIds = await skillsStep(enabledPluginIds, preset?.skills);
        const skills = {};
        for (const id of enabledSkillIds) {
            skills[id] = true;
        }
        // Step 7: Telegram Channel
        const telegram = await channelStep();
        // Step 8: API Key Collection
        const apiKeys = await apiKeysStep(enabledPluginIds, telegram.botToken);
        // Google Drive OAuth (optional, if image-gen or video-gen enabled)
        if (plugins["image-gen"] || plugins["video-gen"]) {
            const driveTokens = await googleDriveOAuthFlow();
            if (driveTokens) {
                apiKeys["drive-oauth-client-id"] = driveTokens.clientId;
                apiKeys["drive-oauth-client-secret"] = driveTokens.clientSecret;
                apiKeys["drive-oauth-refresh-token"] = driveTokens.refreshToken;
            }
        }
        // Build config
        const config = {
            cloudProvider,
            gcp: gcpConfig,
            branding,
            plugins,
            skills,
            telegram,
            apiKeys,
            models: preset?.models ?? {
                primary: "google/gemini-2.5-flash",
                fallbacks: [
                    "anthropic/claude-sonnet-4-5-20250929",
                    "openai/gpt-4o-mini",
                ],
            },
            dryRun: options.dryRun ?? false,
        };
        // Step 9: Confirmation
        const proceed = await confirmStep(config);
        if (!proceed) {
            console.log(chalk.yellow("\n  Deployment cancelled.\n"));
            return;
        }
        // Step 10: Deploy
        const deployer = new GcpDeployer();
        if (config.dryRun) {
            deployer.dryRun(config);
            console.log(chalk.green("\n  Dry run complete. No resources were created.\n"));
        }
        else {
            await deployer.deploy(config);
        }
    }
    catch (error) {
        if (error.name === "ExitPromptError") {
            console.log(chalk.yellow("\n  Wizard cancelled.\n"));
            return;
        }
        throw error;
    }
}
//# sourceMappingURL=index.js.map