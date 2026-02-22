import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const store = mutation({
  args: {
    text: v.string(),
    tags: v.array(v.string()),
    source: v.string(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("knowledge", {
      text: args.text,
      tags: args.tags,
      source: args.source,
      createdAt: Date.now(),
      embedding: args.embedding,
    });
    return id;
  },
});

export const list = query({
  args: {
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const entries = await ctx.db
      .query("knowledge")
      .order("desc")
      .take(limit);

    if (args.tag) {
      return entries.filter((e) => e.tags.includes(args.tag!));
    }
    return entries;
  },
});

export const remove = mutation({
  args: { id: v.id("knowledge") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getById = query({
  args: { id: v.id("knowledge") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ── Tenant-filtered variant ─────────────────────────────────────

export const listByUser = query({
  args: {
    userId: v.string(),
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const entries = await ctx.db
      .query("knowledge")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    if (args.tag) {
      return entries.filter((e) => e.tags.includes(args.tag!));
    }
    return entries;
  },
});
