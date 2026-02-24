import { checkbox } from "@inquirer/prompts";
import { PLUGIN_REGISTRY } from "../config/plugins.js";
export async function pluginsStep(presetPlugins) {
    const selected = await checkbox({
        message: "Select plugins to enable:",
        choices: PLUGIN_REGISTRY.map((plugin) => ({
            name: `${plugin.name} — ${plugin.description}`,
            value: plugin.id,
            checked: presetPlugins ? (presetPlugins[plugin.id] ?? false) : true,
        })),
    });
    return selected;
}
//# sourceMappingURL=plugins.js.map