import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    requestId: v.id("privacyRequests"),
    senderEmail: v.string(),
    senderDomain: v.string(),
    violationType: v.union(v.literal("canspam"), v.literal("ccpa")),
    deadlineDate: v.number(),
    violationDate: v.number(),
    messageIds: v.array(v.string()),
    headers: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("privacyViolations", {
      ...args,
      status: "detected",
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { id: v.id("privacyViolations") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("detected"),
        v.literal("notice_drafted"),
        v.literal("notice_sent"),
        v.literal("resolved"),
      ),
    ),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.userId && args.status) {
      return ctx.db
        .query("privacyViolations")
        .withIndex("by_userId_status", (q) =>
          q.eq("userId", args.userId).eq("status", args.status!),
        )
        .collect();
    }
    if (args.status) {
      const all = await ctx.db.query("privacyViolations").collect();
      return all.filter((v) => v.status === args.status);
    }
    return ctx.db.query("privacyViolations").collect();
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("privacyViolations"),
    status: v.union(
      v.literal("detected"),
      v.literal("notice_drafted"),
      v.literal("notice_sent"),
      v.literal("resolved"),
    ),
    noticeDraft: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});
