import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { BUILT_IN_PRESETS, loadPreset } from "../config/presets.js";
import type { PresetConfig, BrandingConfig } from "../config/types.js";

export interface WhiteLabelResult {
  preset: PresetConfig | null;
  branding: BrandingConfig;
}

export async function whiteLabelStep(
  presetPath?: string,
): Promise<WhiteLabelResult> {
  let preset: PresetConfig | null = null;

  // If --preset was passed, load it directly
  if (presetPath) {
    preset = await loadPreset(presetPath);
    console.log(chalk.green(`  Loaded preset: ${preset.presetName}\n`));
  } else {
    const choice = await select({
      message: "Start from a preset or customize?",
      choices: [
        {
          name: "Social Media Manager — postiz + daily-posts + content-engine + engagement",
          value: "social-media-manager",
        },
        {
          name: "Content Creator — image/video gen + content-engine + newsletter",
          value: "content-creator",
        },
        {
          name: "Full Stack — everything enabled",
          value: "full-stack",
        },
        {
          name: "Custom — pick individually",
          value: "custom",
        },
      ],
    });

    if (choice !== "custom") {
      preset = BUILT_IN_PRESETS[choice];
    }
  }

  const botName = await input({
    message: "Bot name:",
    default: preset?.branding.botName ?? "Claw",
  });

  const personality = await input({
    message: "Bot personality:",
    default: preset?.branding.personality ?? "A helpful AI teammate",
  });

  const systemPrompt = await input({
    message: "Custom system prompt (Enter to skip):",
    default: preset?.branding.systemPrompt ?? "",
  });

  return {
    preset,
    branding: {
      botName,
      personality,
      systemPrompt: systemPrompt || undefined,
    },
  };
}
