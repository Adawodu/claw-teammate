import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import type { DeployConfig } from "../config/types.js";
import { getPluginById } from "../config/plugins.js";
import { getSkillById } from "../config/skills.js";

export async function confirmStep(config: DeployConfig): Promise<boolean> {
  console.log(chalk.bold("\n  ═══ Deployment Summary ═══\n"));

  // Cloud
  console.log(chalk.bold("  Cloud:"));
  console.log(`    Provider:     GCP`);
  console.log(`    Project:      ${config.gcp.projectId}`);
  console.log(`    Zone:         ${config.gcp.zone}`);
  console.log(`    Machine:      ${config.gcp.machineType}`);
  console.log(`    VM:           ${config.gcp.vmName}`);

  // Branding
  console.log(chalk.bold("\n  Branding:"));
  console.log(`    Bot name:     ${config.branding.botName}`);
  console.log(`    Personality:  ${config.branding.personality}`);
  if (config.branding.systemPrompt) {
    console.log(
      `    System prompt: ${config.branding.systemPrompt.substring(0, 60)}...`,
    );
  }

  // Plugins
  const enabledPlugins = Object.entries(config.plugins)
    .filter(([, v]) => v)
    .map(([k]) => k);
  console.log(chalk.bold("\n  Plugins:"));
  for (const id of enabledPlugins) {
    const meta = getPluginById(id);
    console.log(`    ${chalk.green("✓")} ${meta?.name ?? id}`);
  }

  // Skills
  const enabledSkills = Object.entries(config.skills)
    .filter(([, v]) => v)
    .map(([k]) => k);
  console.log(chalk.bold("\n  Skills:"));
  for (const id of enabledSkills) {
    const meta = getSkillById(id);
    const cron = meta?.cron ? chalk.dim(` (${meta.cronDescription})`) : "";
    console.log(`    ${chalk.green("✓")} ${meta?.name ?? id}${cron}`);
  }

  // API Keys
  const keyCount = Object.keys(config.apiKeys).length;
  console.log(chalk.bold("\n  API Keys:"));
  console.log(`    ${keyCount} keys will be stored in Secret Manager`);

  // Cost
  console.log(chalk.bold("\n  Estimated Cost:"));
  const costMap: Record<string, string> = {
    "e2-small": "~$7/mo",
    "e2-medium": "~$14/mo",
    "e2-standard-2": "~$28/mo",
  };
  console.log(
    `    GCP VM: ${costMap[config.gcp.machineType] ?? "varies"} (compute only)`,
  );
  console.log(chalk.dim("    + API usage costs from your providers\n"));

  if (config.dryRun) {
    console.log(
      chalk.yellow("  DRY RUN — no resources will be created\n"),
    );
    return true;
  }

  const proceed = await confirm({
    message: "Deploy now?",
    default: true,
  });

  return proceed;
}
