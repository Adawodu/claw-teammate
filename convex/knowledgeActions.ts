"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { generateEmbedding } from "./lib/embeddings";
import { Id } from "./_generated/dataModel";

export const search = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<Record<string, unknown>>> => {
    const embedding = await generateEmbedding(args.query);
    const results = await ctx.vectorSearch("knowledge", "by_embedding", {
      vector: embedding,
      limit: args.limit ?? 5,
    });

    const entries: Array<Record<string, unknown>> = await Promise.all(
      results.map(async (result) => {
        const doc: Record<string, unknown> | null = await ctx.runQuery(api.knowledge.getById, {
          id: result._id,
        });
        return {
          ...doc,
          score: result._score,
        };
      })
    );

    return entries;
  },
});

export const ingest = action({
  args: {
    text: v.string(),
    tags: v.optional(v.array(v.string())),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"knowledge">> => {
    const embedding = await generateEmbedding(args.text);
    const id: Id<"knowledge"> = await ctx.runMutation(api.knowledge.store, {
      text: args.text,
      tags: args.tags ?? [],
      source: args.source ?? "telegram",
      embedding,
    });
    return id;
  },
});
