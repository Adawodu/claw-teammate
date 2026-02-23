import type { PluginMeta } from "./types";

export const PLUGIN_REGISTRY: PluginMeta[] = [
  {
    id: "postiz",
    name: "Postiz Social Media",
    description: "Create and schedule social media posts across platforms",
    requiredKeys: [
      {
        key: "postizUrl",
        secretName: "postiz-url",
        description: "Postiz instance URL",
        signupUrl: "https://postiz.com",
      },
      {
        key: "postizApiKey",
        secretName: "postiz-api-key",
        description: "Postiz API key",
        signupUrl: "https://postiz.com",
      },
    ],
    optionalKeys: [],
  },
  {
    id: "convex-knowledge",
    name: "Convex Knowledge Base",
    description: "Store and search knowledge for content planning and insights",
    requiredKeys: [
      {
        key: "convexUrl",
        secretName: "convex-url",
        description: "Convex deployment URL",
        signupUrl: "https://convex.dev",
      },
    ],
    optionalKeys: [],
  },
  {
    id: "beehiiv",
    name: "Beehiiv Newsletter",
    description: "Draft and manage newsletter content via Beehiiv",
    requiredKeys: [
      {
        key: "beehiivApiKey",
        secretName: "beehiiv-api-key",
        description: "Beehiiv API key (requires Scale plan)",
        signupUrl: "https://www.beehiiv.com",
      },
      {
        key: "beehiivPublicationId",
        secretName: "beehiiv-publication-id",
        description: "Beehiiv publication ID",
        signupUrl: "https://app.beehiiv.com/settings/workspace/integrations",
      },
    ],
    optionalKeys: [],
  },
  {
    id: "image-gen",
    name: "Image Generation",
    description: "Generate images using Gemini and DALL-E with persistent storage",
    requiredKeys: [
      {
        key: "geminiApiKey",
        secretName: "google-ai-api-key",
        description: "Google AI (Gemini) API key",
        signupUrl: "https://aistudio.google.com/apikey",
      },
    ],
    optionalKeys: [
      {
        key: "openaiApiKey",
        secretName: "openai-api-key",
        description: "OpenAI API key (for DALL-E fallback)",
        signupUrl: "https://platform.openai.com/api-keys",
      },
      {
        key: "convexUrl",
        secretName: "convex-url",
        description: "Convex deployment URL (for media metadata storage)",
        signupUrl: "https://convex.dev",
      },
      {
        key: "driveFolderId",
        secretName: "drive-media-folder-id",
        description: "Google Drive folder ID for media storage",
        signupUrl: "https://drive.google.com",
      },
      {
        key: "driveClientId",
        secretName: "drive-oauth-client-id",
        description: "Google Drive OAuth client ID",
        signupUrl: "https://console.cloud.google.com/apis/credentials",
      },
      {
        key: "driveClientSecret",
        secretName: "drive-oauth-client-secret",
        description: "Google Drive OAuth client secret",
        signupUrl: "https://console.cloud.google.com/apis/credentials",
      },
      {
        key: "driveRefreshToken",
        secretName: "drive-oauth-refresh-token",
        description: "Google Drive OAuth refresh token",
        signupUrl: "https://console.cloud.google.com/apis/credentials",
      },
    ],
  },
  {
    id: "twitter-research",
    name: "Twitter/X Research",
    description: "Research trends, search tweets, and monitor influencers on Twitter/X",
    requiredKeys: [
      {
        key: "bearerToken",
        secretName: "twitter-bearer-token",
        description: "Twitter API Bearer Token",
        signupUrl: "https://developer.x.com/en/portal/dashboard",
      },
    ],
    optionalKeys: [],
  },
  {
    id: "video-gen",
    name: "Video Generation",
    description: "Generate videos using Gemini Veo with persistent storage",
    requiredKeys: [
      {
        key: "geminiApiKey",
        secretName: "google-ai-api-key",
        description: "Google AI (Gemini) API key",
        signupUrl: "https://aistudio.google.com/apikey",
      },
    ],
    optionalKeys: [
      {
        key: "openaiApiKey",
        secretName: "openai-api-key",
        description: "OpenAI API key (for Sora fallback)",
        signupUrl: "https://platform.openai.com/api-keys",
      },
      {
        key: "convexUrl",
        secretName: "convex-url",
        description: "Convex deployment URL (for media metadata storage)",
        signupUrl: "https://convex.dev",
      },
      {
        key: "driveFolderId",
        secretName: "drive-media-folder-id",
        description: "Google Drive folder ID for media storage",
        signupUrl: "https://drive.google.com",
      },
      {
        key: "driveClientId",
        secretName: "drive-oauth-client-id",
        description: "Google Drive OAuth client ID",
        signupUrl: "https://console.cloud.google.com/apis/credentials",
      },
      {
        key: "driveClientSecret",
        secretName: "drive-oauth-client-secret",
        description: "Google Drive OAuth client secret",
        signupUrl: "https://console.cloud.google.com/apis/credentials",
      },
      {
        key: "driveRefreshToken",
        secretName: "drive-oauth-refresh-token",
        description: "Google Drive OAuth refresh token",
        signupUrl: "https://console.cloud.google.com/apis/credentials",
      },
    ],
  },
];

export function getPluginById(id: string): PluginMeta | undefined {
  return PLUGIN_REGISTRY.find((p) => p.id === id);
}

export function getRequiredApiKeys(
  enabledPlugins: string[],
): { key: string; secretName: string; description: string; signupUrl: string; required: boolean }[] {
  const seen = new Set<string>();
  const keys: { key: string; secretName: string; description: string; signupUrl: string; required: boolean }[] = [];

  for (const pluginId of enabledPlugins) {
    const plugin = getPluginById(pluginId);
    if (!plugin) continue;

    for (const k of plugin.requiredKeys) {
      if (!seen.has(k.secretName)) {
        seen.add(k.secretName);
        keys.push({ ...k, required: true });
      }
    }
    for (const k of plugin.optionalKeys) {
      if (!seen.has(k.secretName)) {
        seen.add(k.secretName);
        keys.push({ ...k, required: false });
      }
    }
  }

  return keys;
}
