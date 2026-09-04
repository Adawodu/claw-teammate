import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, optionalUser } from "./lib/auth";

export const create = mutation({
  args: {
    gcpProjectId: v.string(),
    gcpZone: v.string(),
    vmName: v.string(),
    machineType: v.string(),
    branding: v.object({
      botName: v.string(),
      personality: v.string(),
      systemPrompt: v.optional(v.string()),
    }),
    models: v.object({
      primary: v.string(),
      fallbacks: v.array(v.string()),
    }),
    securityMode: v.optional(v.union(v.literal("secured"), v.literal("full-power"))),
    telegramUserId: v.optional(v.string()),
    desiredOpenClawVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    return await ctx.db.insert("deployments", {
      userId,
      status: "provisioning",
      ...args,
      deployedAt: Date.now(),
    });
  },
});

export const get = query({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const deployment = await ctx.db.get(args.id);
    if (!deployment || deployment.userId !== userId) return null;
    return deployment;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalUser(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("deployments")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});


export const remove = mutation({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const deployment = await ctx.db.get(args.id);
    if (!deployment || deployment.userId !== userId) {
      throw new Error("Deployment not found");
    }

    // Clean up related records
    const plugins = await ctx.db
      .query("pluginConfigs")
      .withIndex("by_deploymentId", (q) => q.eq("deploymentId", args.id))
      .collect();
    for (const p of plugins) await ctx.db.delete(p._id);

    const skills = await ctx.db
      .query("skillConfigs")
      .withIndex("by_deploymentId", (q) => q.eq("deploymentId", args.id))
      .collect();
    for (const s of skills) await ctx.db.delete(s._id);

    const keys = await ctx.db
      .query("apiKeyRegistry")
      .withIndex("by_deploymentId", (q) => q.eq("deploymentId", args.id))
      .collect();
    for (const k of keys) await ctx.db.delete(k._id);

    await ctx.db.delete(args.id);
  },
});

export const updateBranding = mutation({
  args: {
    id: v.id("deployments"),
    botName: v.string(),
    personality: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const deployment = await ctx.db.get(args.id);
    if (!deployment || deployment.userId !== userId) {
      throw new Error("Deployment not found");
    }
    await ctx.db.patch(args.id, {
      branding: {
        ...deployment.branding,
        botName: args.botName,
        personality: args.personality,
      },
    });
  },
});

export const updateModels = mutation({
  args: {
    id: v.id("deployments"),
    primary: v.string(),
    fallbacks: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const deployment = await ctx.db.get(args.id);
    if (!deployment || deployment.userId !== userId) {
      throw new Error("Deployment not found");
    }
    await ctx.db.patch(args.id, {
      models: {
        primary: args.primary,
        fallbacks: args.fallbacks,
      },
    });
  },
});

export const updateDesiredVersion = mutation({
  args: {
    id: v.id("deployments"),
    // null/undefined → "track latest from npm". A semver string → pin.
    version: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const deployment = await ctx.db.get(args.id);
    if (!deployment || deployment.userId !== userId) {
      throw new Error("Deployment not found");
    }
    await ctx.db.patch(args.id, {
      desiredOpenClawVersion: args.version ?? undefined,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("deployments"),
    status: v.string(),
    error: v.optional(v.string()),
    lastHealthCheck: v.optional(v.number()),
    lastHealthStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const deployment = await ctx.db.get(args.id);
    if (!deployment || deployment.userId !== userId) {
      throw new Error("Deployment not found");
    }
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});
