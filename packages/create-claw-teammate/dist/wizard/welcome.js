import chalk from "chalk";
import { commandExists } from "../utils/shell.js";
const BANNER = `
   ██████╗██╗      █████╗ ██╗    ██╗
  ██╔════╝██║     ██╔══██╗██║    ██║
  ██║     ██║     ███████║██║ █╗ ██║
  ██║     ██║     ██╔══██║██║███╗██║
  ╚██████╗███████╗██║  ██║╚███╔███╔╝
   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
`;
export async function welcomeStep() {
    console.log(chalk.cyan(BANNER));
    console.log(chalk.bold("  Deploy your own AI teammate on your cloud\n"));
    console.log(chalk.dim("  Bring your own API keys. Own your data. Run on your infra.\n"));
    // Check Node version
    const nodeVersion = process.versions.node;
    const major = parseInt(nodeVersion.split(".")[0], 10);
    if (major < 22) {
        console.log(chalk.red(`  ✗ Node.js >= 22 required (found v${nodeVersion})`));
        console.log(chalk.dim("    Install: https://nodejs.org/en/download\n"));
        process.exit(1);
    }
    console.log(chalk.green(`  ✓ Node.js v${nodeVersion}`));
    // Check gcloud
    const hasGcloud = await commandExists("gcloud");
    if (!hasGcloud) {
        console.log(chalk.red("  ✗ gcloud CLI not found"));
        console.log(chalk.dim("    Install: https://cloud.google.com/sdk/docs/install\n"));
        process.exit(1);
    }
    console.log(chalk.green("  ✓ gcloud CLI installed"));
    // Check gcloud auth
    const { run } = await import("../utils/shell.js");
    const authResult = await run("gcloud", [
        "auth",
        "list",
        "--filter=status:ACTIVE",
        "--format=value(account)",
    ]);
    if (!authResult.stdout.trim()) {
        console.log(chalk.red("  ✗ gcloud not authenticated"));
        console.log(chalk.dim("    Run: gcloud auth login\n"));
        process.exit(1);
    }
    console.log(chalk.green(`  ✓ gcloud authenticated as ${authResult.stdout.trim()}`));
    console.log();
}
//# sourceMappingURL=welcome.js.map