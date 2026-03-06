import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// ── Explicit MCP Tools ─────────────────────────────────────────────

export const store = mutation({
  args: {
    sessionId: v.string(),
    userId: v.string(),
    type: v.union(
      v.literal("fact"),
      v.literal("preference"),
      v.literal("code_pattern"),
      v.literal("decision"),
      v.literal("context"),
    ),
    content: v.string(),
    projectPath: v.optional(v.string()),
    files: v.optional(v.array(v.string())),
    toolCalls: v.optional(v.array(v.string())),
    importance: v.optional(v.number()),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const importance = args.importance ?? 5;
    // Low importance memories expire after 30 days
    const expiresAt =
      importance < 3
        ? Date.now() + 30 * 24 * 60 * 60 * 1000
        : undefined;

    const id = await ctx.db.insert("agentMemory", {
      sessionId: args.sessionId,
      userId: args.userId,
      type: args.type,
      content: args.content,
      context: {
        projectPath: args.projectPath,
        files: args.files,
        toolCalls: args.toolCalls,
      },
      embedding: args.embedding,
      importance,
      expiresAt,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const recall = query({
  args: {
    userId: v.string(),
    query: v.string(),
    queryEmbedding: v.array(v.float64()),
    type: v.optional(
      v.union(
        v.literal("fact"),
        v.literal("preference"),
        v.literal("code_pattern"),
        v.literal("decision"),
        v.literal("context"),
      ),
    ),
    projectPath: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;

    // Get recent memories first (last 100)
    let memories = await ctx.db
      .query("agentMemory")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", args.userId),
      )
      .order("desc")
      .take(100);

    // Filter by type if specified
    if (args.type) {
      memories = memories.filter((m) => m.type === args.type);
    }

    // Filter by project if specified
    if (args.projectPath) {
      memories = memories.filter(
        (m) => m.context.projectPath === args.projectPath,
      );
    }

    // Calculate cosine similarity
    const scored = memories.map((m) => ({
      ...m,
      score: cosineSimilarity(args.queryEmbedding, m.embedding),
    }));

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  },
});

export const searchByContent = query({
  args: {
    userId: v.string(),
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const term = args.searchTerm.toLowerCase();

    // Full-text search (simple contains)
    const memories = await ctx.db
      .query("agentMemory")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", args.userId),
      )
      .order("desc")
      .take(200);

    return memories
      .filter((m) => m.content.toLowerCase().includes(term))
      .slice(0, limit);
  },
});

// ── Session Management ─────────────────────────────────────────────

export const startSession = mutation({
  args: {
    sessionId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("agentSessions", {
      sessionId: args.sessionId,
      userId: args.userId,
      startedAt: Date.now(),
      keyDecisions: [],
      todosCompleted: [],
      todosPending: [],
      tokenUsage: { input: 0, output: 0, costUsd: 0 },
    });
    return id;
  },
});

export const endSession = mutation({
  args: {
    sessionId: v.string(),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("agentSessions")
      .withIndex("by_sessionId", (q) =>
        q.eq("sessionId", args.sessionId),
      )
      .unique();

    if (session) {
      await ctx.db.patch(session._id, {
        endedAt: Date.now(),
        summary: args.summary,
      });
    }
    return session?._id;
  },
});

export const updateSession = mutation({
  args: {
    sessionId: v.string(),
    keyDecision: v.optional(
      v.object({
        decision: v.string(),
        reasoning: v.string(),
        files: v.array(v.string()),
      }),
    ),
    todoCompleted: v.optional(v.string()),
    todoPending: v.optional(
      v.object({
        task: v.string(),
        priority: v.number(),
      }),
    ),
    tokenUsage: v.optional(
      v.object({
        input: v.number(),
        output: v.number(),
        costUsd: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("agentSessions")
      .withIndex("by_sessionId", (q) =>
        q.eq("sessionId", args.sessionId),
      )
      .unique();

    if (!session) return null;

    const updates: any = {};

    if (args.keyDecision) {
      updates.keyDecisions = [
        ...session.keyDecisions,
        args.keyDecision,
      ];
    }

    if (args.todoCompleted) {
      updates.todosCompleted = [
        ...session.todosCompleted,
        args.todoCompleted,
      ];
      updates.todosPending = session.todosPending.filter(
        (t) => t.task !== args.todoCompleted,
      );
    }

    if (args.todoPending) {
      updates.todosPending = [...session.todosPending, args.todoPending];
    }

    if (args.tokenUsage) {
      updates.tokenUsage = {
        input: session.tokenUsage.input + args.tokenUsage.input,
        output: session.tokenUsage.output + args.tokenUsage.output,
        costUsd: session.tokenUsage.costUsd + args.tokenUsage.costUsd,
      };
    }

    await ctx.db.patch(session._id, updates);
    return session._id;
  },
});

export const getSession = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_sessionId", (q) =>
        q.eq("sessionId", args.sessionId),
      )
      .unique();
  },
});

export const listSessions = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_userId_startedAt", (q) =>
        q.eq("userId", args.userId),
      )
      .order("desc")
      .take(limit);
  },
});

// ── Auto-Sync Support ─────────────────────────────────────────────

export const getRecentContext = query({
  args: {
    userId: v.string(),
    projectPath: v.optional(v.string()),
    hoursBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hours = args.hoursBack ?? 24;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    let memories = await ctx.db
      .query("agentMemory")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", args.userId),
      )
      .order("desc")
      .take(50);

    memories = memories.filter((m) => m.createdAt > cutoff);

    if (args.projectPath) {
      memories = memories.filter(
        (m) => m.context.projectPath === args.projectPath,
      );
    }

    return memories;
  },
});

export const getProjectContext = query({
  args: {
    userId: v.string(),
    projectPath: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("agentMemory")
      .withIndex("by_projectPath", (q) =>
        q.eq("context.projectPath", args.projectPath),
      )
      .order("desc")
      .take(limit);
  },
});

// ── Cleanup ───────────────────────────────────────────────────────

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("agentMemory")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    for (const memory of expired) {
      await ctx.db.delete(memory._id);
    }

    return { deleted: expired.length };
  },
});

export const deleteMemory = mutation({
  args: {
    id: v.id("agentMemory"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ── Helper Functions ──────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
