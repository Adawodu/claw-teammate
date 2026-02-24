import { readFile } from "node:fs/promises";
import type { PresetConfig } from "@dynoclaw/shared";

export { BUILT_IN_PRESETS } from "@dynoclaw/shared";
import { BUILT_IN_PRESETS } from "@dynoclaw/shared";

export async function loadPreset(source: string): Promise<PresetConfig> {
  // Built-in preset name
  if (source in BUILT_IN_PRESETS) {
    return BUILT_IN_PRESETS[source];
  }

  // URL
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Failed to fetch preset from ${source}: ${res.statusText}`);
    return (await res.json()) as PresetConfig;
  }

  // Local file
  const content = await readFile(source, "utf-8");
  return JSON.parse(content) as PresetConfig;
}
