import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const store = mutation({
  args: {
    storageId: v.id("_storage"),
    type: v.string(),
    prompt: v.string(),
    provider: v.string(),
    mimeType: v.string(),
    driveUrl: v.optional(v.string()),
    driveFileId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("media", {
      ...args,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateDriveInfo = mutation({
  args: {
    id: v.id("media"),
    driveUrl: v.string(),
    driveFileId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      driveUrl: args.driveUrl,
      driveFileId: args.driveFileId,
    });
  },
});

export const list = query({
  args: {
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    if (args.type) {
      const entries = await ctx.db
        .query("media")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .take(limit);
      return Promise.all(
        entries.map(async (entry) => ({
          ...entry,
          url: await ctx.storage.getUrl(entry.storageId),
        })),
      );
    }

    const entries = await ctx.db
      .query("media")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
    return Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        url: await ctx.storage.getUrl(entry.storageId),
      })),
    );
  },
});

export const getById = query({
  args: { id: v.id("media") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) return null;
    const url = await ctx.storage.getUrl(entry.storageId);
    return { ...entry, url };
  },
});
