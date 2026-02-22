import { checkbox } from "@inquirer/prompts";
import chalk from "chalk";
import { SKILL_REGISTRY } from "../config/skills.js";

export async function skillsStep(
  enabledPlugins: string[],
  presetSkills?: Record<string, boolean>,
): Promise<string[]> {
  const enabledSet = new Set(enabledPlugins);

  const selected = await checkbox({
    message: "Select skills to enable:",
    choices: SKILL_REGISTRY.map((skill) => {
      const missingPlugins = skill.requiredPlugins.filter(
        (p) => !enabledSet.has(p),
      );
      const disabled = missingPlugins.length > 0;
      const suffix = disabled
        ? chalk.dim(` [requires: ${missingPlugins.join(", ")}]`)
        : "";
      const cronInfo = skill.cron
        ? chalk.dim(` (${skill.cronDescription})`)
        : chalk.dim(" (on-demand)");

      return {
        name: `${skill.name}${cronInfo} — ${skill.description}${suffix}`,
        value: skill.id,
        checked: disabled
          ? false
          : presetSkills
            ? (presetSkills[skill.id] ?? false)
            : true,
        disabled: disabled ? `requires ${missingPlugins.join(", ")}` : false,
      };
    }),
  });

  return selected;
}
