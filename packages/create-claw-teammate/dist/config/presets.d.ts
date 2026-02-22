import type { PresetConfig } from "./types.js";
export declare const BUILT_IN_PRESETS: Record<string, PresetConfig>;
export declare function loadPreset(source: string): Promise<PresetConfig>;
