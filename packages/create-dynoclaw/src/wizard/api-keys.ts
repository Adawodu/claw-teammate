import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { openUrl } from "../utils/browser.js";
import { getRequiredApiKeys } from "../config/plugins.js";

// Core keys always required regardless of plugins
const CORE_KEYS = [
  {
    key: "telegramBotToken",
    secretName: "telegram-bot-token",
    description: "Telegram bot token",
    signupUrl: "https://t.me/BotFather",
    required: true,
  },
  {
    key: "googleAiApiKey",
    secretName: "google-ai-api-key",
    description: "Google AI (Gemini) API key — primary model",
    signupUrl: "https://aistudio.google.com/apikey",
    required: true,
  },
  {
    key: "anthropicApiKey",
    secretName: "anthropic-api-key",
    description: "Anthropic API key — fallback model",
    signupUrl: "https://console.anthropic.com/settings/keys",
    required: true,
  },
  {
    key: "braveApiKey",
    secretName: "brave-api-key",
    description: "Brave Search API key — web search",
    signupUrl: "https://brave.com/search/api/",
    required: true,
  },
  {
    key: "openaiApiKey",
    secretName: "openai-api-key",
    description: "OpenAI API key — fallback model + DALL-E/Sora",
    signupUrl: "https://platform.openai.com/api-keys",
    required: false,
  },
];

export async function apiKeysStep(
  enabledPlugins: string[],
  telegramToken: string,
): Promise<Record<string, string>> {
  console.log(chalk.bold("\n  API Key Collection\n"));
  console.log(
    chalk.dim(
      "  Keys are stored in GCP Secret Manager — never in code.\n",
    ),
  );

  const pluginKeys = getRequiredApiKeys(enabledPlugins);

  // Merge core keys + plugin-specific keys, deduplicating by secretName
  const seen = new Set<string>();
  const allKeys: typeof CORE_KEYS = [];

  for (const k of CORE_KEYS) {
    seen.add(k.secretName);
    allKeys.push(k);
  }
  for (const k of pluginKeys) {
    if (!seen.has(k.secretName)) {
      seen.add(k.secretName);
      allKeys.push(k);
    }
  }

  // Sort: required first
  allKeys.sort((a, b) => {
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return 0;
  });

  const apiKeys: Record<string, string> = {};

  // Pre-fill telegram token from channel step
  apiKeys["telegram-bot-token"] = telegramToken;

  for (const keyMeta of allKeys) {
    // Skip telegram — already collected
    if (keyMeta.secretName === "telegram-bot-token") continue;

    const label = keyMeta.required
      ? chalk.red("*") + " " + keyMeta.description
      : chalk.dim("(optional)") + " " + keyMeta.description;

    console.log(`\n  ${label}`);
    console.log(chalk.dim(`  → ${keyMeta.signupUrl}`));

    const shouldOpen = await confirm({
      message: `Open signup page in browser?`,
      default: false,
    });

    if (shouldOpen) {
      await openUrl(keyMeta.signupUrl);
    }

    const value = await input({
      message: `${keyMeta.secretName}:`,
      validate: (val) => {
        if (keyMeta.required && !val.trim()) {
          return `${keyMeta.secretName} is required`;
        }
        return true;
      },
    });

    if (value.trim()) {
      apiKeys[keyMeta.secretName] = value.trim();
    }
  }

  return apiKeys;
}
