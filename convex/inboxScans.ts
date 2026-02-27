import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    totalMessages: v.number(),
    uniqueSenders: v.number(),
    senders: v.array(
      v.object({
        email: v.string(),
        domain: v.string(),
        count: v.number(),
        hasUnsubscribe: v.boolean(),
        latestDate: v.string(),
        subjects: v.array(v.string()),
        category: v.string(),
      }),
    ),
    categoryBreakdown: v.object({
      Essential: v.optional(v.number()),
      Aggressor: v.optional(v.number()),
      Marketing: v.optional(v.number()),
      Lapsed: v.optional(v.number()),
      Unknown: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("inboxScans", {
      ...args,
      scannedAt: Date.now(),
    });
  },
});

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const scans = await ctx.db
      .query("inboxScans")
      .withIndex("by_scannedAt")
      .order("desc")
      .take(1);
    return scans[0] ?? null;
  },
});

export const markSafe = mutation({
  args: {
    senderDomain: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the latest scan
    const scans = await ctx.db
      .query("inboxScans")
      .withIndex("by_scannedAt")
      .order("desc")
      .take(1);
    const scan = scans[0];
    if (!scan) throw new Error("No inbox scan found");

    const updatedSenders = scan.senders.map((s) =>
      s.domain === args.senderDomain ? { ...s, category: "Essential" } : s,
    );

    // Recalculate category breakdown
    const categoryBreakdown: Record<string, number> = {};
    for (const s of updatedSenders) {
      categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1;
    }

    await ctx.db.patch(scan._id, {
      senders: updatedSenders,
      categoryBreakdown,
    });

    return { success: true, domain: args.senderDomain };
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("inboxScans")
      .withIndex("by_scannedAt")
      .order("desc")
      .take(args.limit ?? 10);
  },
});
