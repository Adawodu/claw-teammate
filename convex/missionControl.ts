import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Mission Control — cross-context cockpit backend.
 *
 * Generalizes the dynoclux canvas pattern (canvas → Convex → agent
 * action queue → human approval) across all workspaces. Functions are
 * public (no requireUser) and single-tenant for jonnymate, matching the
 * working actionQueue pattern; `userId` is accepted/stored optionally so
 * multi-tenant is a later filter, not a rewrite.
 *
 * Cognitive Stack mapping: workspaces=Synapse, mcTasks=Maru,
 * mcActions+mcApprovalPolicy=Nzube (driver's seat), mcActivity=CFP.
 */

const TASK_STATUS = v.union(
  v.literal("backlog"),
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("blocked"),
  v.literal("done"),
);

const ACTION_STATE = v.union(
  v.literal("proposed"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("running"),
  v.literal("done"),
  v.literal("failed"),
);

const ACTIVITY_KIND = v.union(
  v.literal("message"),
  v.literal("tool"),
  v.literal("reasoning"),
  v.literal("system"),
);

const GATE = v.union(v.literal("auto"), v.literal("gated"));

// ── Workspaces (Synapse) ──────────────────────────────────────────

export const listWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("workspaces").collect();
    return all
      .filter((w) => !w.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const getWorkspaceBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/** Idempotently create the two starter workspaces. */
export const seedDefaults = mutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    const defaults = [
      {
        slug: "marketing",
        name: "Marketing",
        kind: "marketing" as const,
        emoji: "📣",
        description: "Content calendar, posts, newsletter, engagement.",
        sortOrder: 0,
      },
      {
        slug: "lead-management",
        name: "Lead Management",
        kind: "lead_management" as const,
        emoji: "🎯",
        description: "Clarify CRM pipeline, outreach, follow-ups.",
        sortOrder: 1,
      },
    ];
    const created: string[] = [];
    for (const d of defaults) {
      const existing = await ctx.db
        .query("workspaces")
        .withIndex("by_slug", (q) => q.eq("slug", d.slug))
        .unique();
      if (existing) continue;
      const now = Date.now();
      await ctx.db.insert("workspaces", {
        ...d,
        userId,
        archived: false,
        createdAt: now,
        updatedAt: now,
      });
      created.push(d.slug);
    }
    return { created };
  },
});

// ── Tasks (Maru — the visible board) ──────────────────────────────

export const listTasks = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const rows = await ctx.db
      .query("mcTasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    return rows.sort((a, b) => a.order - b.order);
  },
});

export const createTask = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    detail: v.optional(v.string()),
    status: v.optional(TASK_STATUS),
    priority: v.optional(v.number()),
    origin: v.optional(v.union(v.literal("human"), v.literal("agent"))),
    assignedAgent: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("mcTasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const order = existing.reduce((m, t) => Math.max(m, t.order), -1) + 1;
    return await ctx.db.insert("mcTasks", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      title: args.title,
      detail: args.detail,
      status: args.status ?? "todo",
      priority: args.priority,
      order,
      origin: args.origin ?? "human",
      assignedAgent: args.assignedAgent,
      dueAt: args.dueAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTask = mutation({
  args: {
    id: v.id("mcTasks"),
    title: v.optional(v.string()),
    detail: v.optional(v.string()),
    status: v.optional(TASK_STATUS),
    priority: v.optional(v.number()),
    order: v.optional(v.number()),
    assignedAgent: v.optional(v.string()),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch(id, { ...clean, updatedAt: Date.now() });
    return true;
  },
});

export const deleteTask = mutation({
  args: { id: v.id("mcTasks") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// ── Actions (Nzube — the approval queue / driver's seat) ──────────

export const listActions = query({
  args: { workspaceId: v.id("workspaces"), state: v.optional(ACTION_STATE) },
  handler: async (ctx, { workspaceId, state }) => {
    let rows = await ctx.db
      .query("mcActions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    if (state) rows = rows.filter((a) => a.state === state);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Everything awaiting your approval, across all workspaces. */
export const pendingActions = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("mcActions")
      .withIndex("by_state", (q) => q.eq("state", "proposed"))
      .collect();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  },
});

/** Approved-but-not-yet-run actions — the agent polls these to execute. */
export const approvedActions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("mcActions")
      .withIndex("by_state", (q) => q.eq("state", "approved"))
      .collect();
  },
});

/** Agent proposes an action. Auto-approves if policy says so. */
export const proposeAction = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.string(),
    summary: v.string(),
    payload: v.optional(v.any()),
    taskId: v.optional(v.id("mcTasks")),
    proposedByAgent: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const policy = await ctx.db
      .query("mcApprovalPolicy")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("actionType", args.type),
      )
      .unique();
    const gate = policy?.gate ?? "gated";
    const state = gate === "auto" ? "approved" : "proposed";
    const id = await ctx.db.insert("mcActions", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      taskId: args.taskId,
      type: args.type,
      summary: args.summary,
      payload: args.payload,
      state,
      gate,
      proposedByAgent: args.proposedByAgent,
      createdAt: now,
      updatedAt: now,
    });
    return { id, gate, state };
  },
});

/** You approve or reject a proposed action. */
export const decideAction = mutation({
  args: {
    id: v.id("mcActions"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    decidedBy: v.optional(v.string()),
  },
  handler: async (ctx, { id, decision, decidedBy }) => {
    const a = await ctx.db.get(id);
    if (!a || a.state !== "proposed") return false;
    const now = Date.now();
    await ctx.db.patch(id, {
      state: decision === "approve" ? "approved" : "rejected",
      decidedBy,
      decidedAt: now,
      updatedAt: now,
    });
    return true;
  },
});

export const startAction = mutation({
  args: { id: v.id("mcActions") },
  handler: async (ctx, { id }) => {
    const a = await ctx.db.get(id);
    if (!a || a.state !== "approved") return false;
    await ctx.db.patch(id, { state: "running", updatedAt: Date.now() });
    return true;
  },
});

export const completeAction = mutation({
  args: { id: v.id("mcActions"), result: v.optional(v.any()) },
  handler: async (ctx, { id, result }) => {
    await ctx.db.patch(id, {
      state: "done",
      result,
      updatedAt: Date.now(),
    });
  },
});

export const failAction = mutation({
  args: { id: v.id("mcActions"), error: v.string() },
  handler: async (ctx, { id, error }) => {
    await ctx.db.patch(id, {
      state: "failed",
      error,
      updatedAt: Date.now(),
    });
  },
});

// ── Approval policy (Nzube — per-action auto/gated) ───────────────

export const listPolicies = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query("mcApprovalPolicy")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

export const setPolicy = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    actionType: v.string(),
    gate: GATE,
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mcApprovalPolicy")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("actionType", args.actionType),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        gate: args.gate,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("mcApprovalPolicy", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      actionType: args.actionType,
      gate: args.gate,
      updatedAt: Date.now(),
    });
  },
});

// ── Activity feed (CFP — visible reasoning/tool trace) ────────────

export const listActivity = query({
  args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
  handler: async (ctx, { workspaceId, limit }) => {
    return await ctx.db
      .query("mcActivity")
      .withIndex("by_workspace_createdAt", (q) =>
        q.eq("workspaceId", workspaceId),
      )
      .order("desc")
      .take(limit ?? 50);
  },
});

export const logActivity = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    kind: ACTIVITY_KIND,
    text: v.string(),
    agent: v.optional(v.string()),
    refActionId: v.optional(v.id("mcActions")),
    refTaskId: v.optional(v.id("mcTasks")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mcActivity", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
