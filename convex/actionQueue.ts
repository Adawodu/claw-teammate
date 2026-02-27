import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    action: v.string(),
    senderEmail: v.string(),
    senderDomain: v.string(),
    params: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Dedup: skip if a pending/running/done entry already exists for this domain+action
    const existing = await ctx.db
      .query("actionQueue")
      .withIndex("by_domain_action", (q) =>
        q.eq("senderDomain", args.senderDomain).eq("action", args.action)
      )
      .collect();
    const dominated = existing.some(
      (e) => e.status === "pending" || e.status === "running" || e.status === "done"
    );
    if (dominated) return null;

    return ctx.db.insert("actionQueue", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("actionQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("actionQueue")
      .withIndex("by_createdAt")
      .order("desc")
      .take(args.limit ?? 100);
  },
});

export const claim = mutation({
  args: { id: v.id("actionQueue") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item || item.status !== "pending") return false;
    await ctx.db.patch(args.id, { status: "running" });
    return true;
  },
});

export const complete = mutation({
  args: {
    id: v.id("actionQueue"),
    result: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "done",
      result: args.result,
      completedAt: Date.now(),
    });
  },
});

export const fail = mutation({
  args: {
    id: v.id("actionQueue"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "error",
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("actionQueue") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Purge completed (done/error) items older than `olderThanMs` (default 7 days)
export const cleanup = mutation({
  args: { olderThanMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.olderThanMs ?? 7 * 24 * 60 * 60 * 1000);
    const old = await ctx.db
      .query("actionQueue")
      .withIndex("by_createdAt")
      .filter((q) =>
        q.and(
          q.lt(q.field("createdAt"), cutoff),
          q.or(q.eq(q.field("status"), "done"), q.eq(q.field("status"), "error"))
        )
      )
      .collect();
    for (const item of old) {
      await ctx.db.delete(item._id);
    }
    return { deleted: old.length };
  },
});
