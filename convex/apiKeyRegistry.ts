import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const register = mutation({
  args: {
    deploymentId: v.id("deployments"),
    secretName: v.string(),
    maskedValue: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    return await ctx.db.insert("apiKeyRegistry", {
      userId,
      deploymentId: args.deploymentId,
      secretName: args.secretName,
      maskedValue: args.maskedValue,
      createdAt: Date.now(),
    });
  },
});

export const listByDeployment = query({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeyRegistry")
      .withIndex("by_deploymentId", (q) => q.eq("deploymentId", args.deploymentId))
      .collect();
  },
});

export const markRotated = mutation({
  args: {
    id: v.id("apiKeyRegistry"),
    maskedValue: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      maskedValue: args.maskedValue,
      rotatedAt: Date.now(),
    });
  },
});
