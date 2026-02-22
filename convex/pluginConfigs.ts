import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const set = mutation({
  args: {
    deploymentId: v.id("deployments"),
    pluginId: v.string(),
    enabled: v.boolean(),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const existing = await ctx.db
      .query("pluginConfigs")
      .withIndex("by_deploymentId", (q) => q.eq("deploymentId", args.deploymentId))
      .filter((q) => q.eq(q.field("pluginId"), args.pluginId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        config: args.config,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("pluginConfigs", {
      userId,
      deploymentId: args.deploymentId,
      pluginId: args.pluginId,
      enabled: args.enabled,
      config: args.config,
      updatedAt: Date.now(),
    });
  },
});

export const listByDeployment = query({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pluginConfigs")
      .withIndex("by_deploymentId", (q) => q.eq("deploymentId", args.deploymentId))
      .collect();
  },
});

export const toggle = mutation({
  args: {
    id: v.id("pluginConfigs"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
  },
});
