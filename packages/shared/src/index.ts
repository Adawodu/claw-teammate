// Fallback version used by the dashboard generator when the npm registry
// is unreachable and no per-deployment pin is set. Also the version baked
// into create-dynoclaw CLI templates. Keep current with latest stable.
export const OPENCLAW_VERSION = "2026.4.25";

export type {
  DeployConfig,
  GcpConfig,
  BrandingConfig,
  TelegramConfig,
  ModelsConfig,
  PluginMeta,
  ApiKeyMeta,
  SkillMeta,
  PresetConfig,
  CloudDeployer,
} from "./types";

export {
  PLUGIN_REGISTRY,
  PLATFORM_SECRETS,
  getAllSecretNames,
  getPluginById,
  getRequiredApiKeys,
} from "./plugins";

export {
  SKILL_REGISTRY,
  getSkillById,
} from "./skills";

export {
  BUILT_IN_PRESETS,
} from "./presets";
