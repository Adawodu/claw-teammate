import type { PresetConfig, BrandingConfig } from "../config/types.js";
export interface WhiteLabelResult {
    preset: PresetConfig | null;
    branding: BrandingConfig;
}
export declare function whiteLabelStep(presetPath?: string): Promise<WhiteLabelResult>;
