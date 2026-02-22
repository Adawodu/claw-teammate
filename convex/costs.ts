import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const storeSnapshot = mutation({
  args: {
    fetchedAt: v.number(),
    openrouterBalance: v.number(),
    openrouterUsed30d: v.number(),
    openaiCostToday: v.number(),
    openaiCostMtd: v.number(),
    gcpEstimateMo: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("costSnapshots", args);
  },
});

export const upsertActivity = mutation({
  args: {
    date: v.string(),
    model: v.string(),
    usageUsd: v.number(),
    requests: v.number(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    reasoningTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("openrouterActivity")
      .withIndex("by_date_model", (q) =>
        q.eq("date", args.date).eq("model", args.model)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        usageUsd: args.usageUsd,
        requests: args.requests,
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
        reasoningTokens: args.reasoningTokens,
        lastUpdated: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("openrouterActivity", {
      ...args,
      lastUpdated: Date.now(),
    });
  },
});

export const latestSnapshot = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("costSnapshots")
      .withIndex("by_fetchedAt")
      .order("desc")
      .first();
  },
});

export const recentActivity = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const rows = await ctx.db
      .query("openrouterActivity")
      .withIndex("by_date")
      .order("desc")
      .collect();

    return rows.filter((r) => r.date >= cutoffStr);
  },
});

// ── Tenant-filtered variants ────────────────────────────────────

export const latestSnapshotByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("costSnapshots")
      .withIndex("by_userId_fetchedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
  },
});

export const recentActivityByUser = query({
  args: { userId: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const rows = await ctx.db
      .query("openrouterActivity")
      .withIndex("by_userId_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return rows.filter((r) => r.date >= cutoffStr);
  },
});
