import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    senderEmail: v.string(),
    senderDomain: v.string(),
    requestType: v.union(v.literal("unsubscribe"), v.literal("data_deletion")),
    method: v.optional(v.string()),
    requestedAt: v.number(),
    deadline: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("privacyRequests", {
      ...args,
      status: "pending",
    });
  },
});

export const get = query({
  args: { id: v.id("privacyRequests") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const list = query({
  args: {
    status: v.optional(
      v.union(v.literal("pending"), v.literal("complied"), v.literal("violated")),
    ),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.userId && args.status) {
      return ctx.db
        .query("privacyRequests")
        .withIndex("by_userId_status", (q) =>
          q.eq("userId", args.userId).eq("status", args.status!),
        )
        .collect();
    }
    if (args.status) {
      return ctx.db
        .query("privacyRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return ctx.db.query("privacyRequests").collect();
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("privacyRequests").collect();
    const now = Date.now();
    let pending = 0;
    let complied = 0;
    let violated = 0;
    let overdueCount = 0;
    for (const r of all) {
      if (r.status === "pending") {
        pending++;
        if (r.deadline < now) overdueCount++;
      } else if (r.status === "complied") {
        complied++;
      } else if (r.status === "violated") {
        violated++;
      }
    }
    return { total: all.length, pending, complied, violated, overdueCount };
  },
});

export const listExpired = query({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("privacyRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending.filter((r) => r.deadline < args.now);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("privacyRequests"),
    status: v.union(
      v.literal("pending"),
      v.literal("complied"),
      v.literal("violated"),
    ),
    evidence: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});
