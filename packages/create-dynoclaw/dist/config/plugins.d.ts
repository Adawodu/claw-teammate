import type { PluginMeta } from "./types.js";
export declare const PLUGIN_REGISTRY: PluginMeta[];
export declare function getPluginById(id: string): PluginMeta | undefined;
export declare function getRequiredApiKeys(enabledPlugins: string[]): {
    key: string;
    secretName: string;
    description: string;
    signupUrl: string;
    required: boolean;
}[];
