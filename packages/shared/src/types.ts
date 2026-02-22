export interface DeployConfig {
  cloudProvider: "gcp";
  gcp: GcpConfig;
  branding: BrandingConfig;
  plugins: Record<string, boolean>;
  skills: Record<string, boolean>;
  telegram: TelegramConfig;
  apiKeys: Record<string, string>;
  models: ModelsConfig;
  dryRun: boolean;
}

export interface GcpConfig {
  projectId: string;
  region: string;
  zone: string;
  machineType: string;
  vmName: string;
}

export interface BrandingConfig {
  botName: string;
  personality: string;
  systemPrompt?: string;
}

export interface TelegramConfig {
  botToken: string;
}

export interface ModelsConfig {
  primary: string;
  fallbacks: string[];
}

export interface PluginMeta {
  id: string;
  name: string;
  description: string;
  requiredKeys: ApiKeyMeta[];
  optionalKeys: ApiKeyMeta[];
}

export interface ApiKeyMeta {
  key: string;
  secretName: string;
  description: string;
  signupUrl: string;
  validate?: (value: string) => boolean;
}

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  cron: string | null;
  cronDescription: string;
  requiredPlugins: string[];
}

export interface PresetConfig {
  presetName: string;
  branding: BrandingConfig;
  plugins: Record<string, boolean>;
  skills: Record<string, boolean>;
  models: ModelsConfig;
}

export interface CloudDeployer {
  deploy(config: DeployConfig): Promise<void>;
  dryRun(config: DeployConfig): void;
}
