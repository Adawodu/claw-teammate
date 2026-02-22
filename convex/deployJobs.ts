import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const enqueue = mutation({
  args: {
    deploymentId: v.id("deployments"),
    action: v.string(),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    return await ctx.db.insert("deployJobs", {
      userId,
      deploymentId: args.deploymentId,
      status: "pending",
      action: args.action,
      config: args.config,
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { id: v.id("deployJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("deployJobs"),
    status: v.string(),
    log: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return await ctx.db
      .query("deployJobs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});
