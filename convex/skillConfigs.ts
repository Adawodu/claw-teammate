import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const set = mutation({
  args: {
    deploymentId: v.id("deployments"),
    skillId: v.string(),
    enabled: v.boolean(),
    cronOverride: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const existing = await ctx.db
      .query("skillConfigs")
      .withIndex("by_deploymentId", (q) => q.eq("deploymentId", args.deploymentId))
      .filter((q) => q.eq(q.field("skillId"), args.skillId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        cronOverride: args.cronOverride,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("skillConfigs", {
      userId,
      deploymentId: args.deploymentId,
      skillId: args.skillId,
      enabled: args.enabled,
      cronOverride: args.cronOverride,
      updatedAt: Date.now(),
    });
  },
});

export const listByDeployment = query({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("skillConfigs")
      .withIndex("by_deploymentId", (q) => q.eq("deploymentId", args.deploymentId))
      .collect();
  },
});

export const toggle = mutation({
  args: {
    id: v.id("skillConfigs"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
  },
});

export const updateCron = mutation({
  args: {
    id: v.id("skillConfigs"),
    cronOverride: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      cronOverride: args.cronOverride,
      updatedAt: Date.now(),
    });
  },
});
