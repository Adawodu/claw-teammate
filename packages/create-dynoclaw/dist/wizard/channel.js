import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { openUrl } from "../utils/browser.js";
export async function channelStep() {
    console.log(chalk.bold("\n  Telegram Bot Setup\n"));
    console.log(chalk.dim("  Your AI teammate communicates via Telegram."));
    console.log(chalk.dim("  You'll need a bot token from @BotFather.\n"));
    console.log("  Steps:");
    console.log("  1. Open Telegram and search for @BotFather");
    console.log("  2. Send /newbot and follow the prompts");
    console.log("  3. Copy the bot token (looks like 123456:ABC-DEF...)\n");
    const shouldOpen = await confirm({
        message: "Open BotFather in browser?",
        default: true,
    });
    if (shouldOpen) {
        await openUrl("https://t.me/BotFather");
    }
    const botToken = await input({
        message: "Paste your Telegram bot token:",
        validate: (value) => {
            if (!value.trim())
                return "Bot token is required";
            if (!/^\d+:.+$/.test(value.trim())) {
                return "Invalid token format (expected: 123456:ABC-DEF...)";
            }
            return true;
        },
    });
    return { botToken: botToken.trim() };
}
//# sourceMappingURL=channel.js.map