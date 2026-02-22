"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

type MediaResult = { mediaId: Id<"media">; storageId: Id<"_storage">; url: string | null };

export const storeImage = action({
  args: {
    base64Data: v.string(),
    mimeType: v.string(),
    prompt: v.string(),
    provider: v.string(),
  },
  handler: async (ctx, args): Promise<MediaResult> => {
    const binary = Buffer.from(args.base64Data, "base64");
    const blob = new Blob([binary], { type: args.mimeType });

    const storageId = await ctx.storage.store(blob);
    const mediaId: Id<"media"> = await ctx.runMutation(api.media.store, {
      storageId,
      type: "image",
      prompt: args.prompt,
      provider: args.provider,
      mimeType: args.mimeType,
    });

    const url = await ctx.storage.getUrl(storageId);
    return { mediaId, storageId, url };
  },
});

export const storeVideo = action({
  args: {
    sourceUrl: v.string(),
    mimeType: v.string(),
    prompt: v.string(),
    provider: v.string(),
    authHeader: v.optional(v.string()),
    apiKeyHeader: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<MediaResult> => {
    const headers: Record<string, string> = {};
    if (args.authHeader) {
      headers["Authorization"] = args.authHeader;
    }
    if (args.apiKeyHeader) {
      headers["x-goog-api-key"] = args.apiKeyHeader;
    }

    const res = await fetch(args.sourceUrl, { headers });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch video from source URL: ${res.status} ${res.statusText}`,
      );
    }

    const blob = await res.blob();
    const storageId = await ctx.storage.store(blob);
    const mediaId: Id<"media"> = await ctx.runMutation(api.media.store, {
      storageId,
      type: "video",
      prompt: args.prompt,
      provider: args.provider,
      mimeType: args.mimeType,
    });

    const url = await ctx.storage.getUrl(storageId);
    return { mediaId, storageId, url };
  },
});

export const storeImageFromUrl = action({
  args: {
    sourceUrl: v.string(),
    mimeType: v.string(),
    prompt: v.string(),
    provider: v.string(),
  },
  handler: async (ctx, args): Promise<MediaResult> => {
    const res = await fetch(args.sourceUrl);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch image from URL: ${res.status} ${res.statusText}`,
      );
    }

    const blob = await res.blob();
    const storageId = await ctx.storage.store(blob);
    const mediaId: Id<"media"> = await ctx.runMutation(api.media.store, {
      storageId,
      type: "image",
      prompt: args.prompt,
      provider: args.provider,
      mimeType: args.mimeType,
    });

    const url = await ctx.storage.getUrl(storageId);
    return { mediaId, storageId, url };
  },
});
