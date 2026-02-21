import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  knowledge: defineTable({
    text: v.string(),
    tags: v.array(v.string()),
    source: v.string(),
    createdAt: v.number(),
    embedding: v.array(v.float64()),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["tags"],
  }),

  costSnapshots: defineTable({
    fetchedAt: v.number(),
    openrouterBalance: v.number(),
    openrouterUsed30d: v.number(),
    openaiCostToday: v.number(),
    openaiCostMtd: v.number(),
    gcpEstimateMo: v.number(),
    error: v.optional(v.string()),
  }).index("by_fetchedAt", ["fetchedAt"]),

  openrouterActivity: defineTable({
    date: v.string(),
    model: v.string(),
    usageUsd: v.number(),
    requests: v.number(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    reasoningTokens: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_date_model", ["date", "model"]),

  media: defineTable({
    storageId: v.id("_storage"),
    type: v.string(),
    prompt: v.string(),
    provider: v.string(),
    mimeType: v.string(),
    driveUrl: v.optional(v.string()),
    driveFileId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_createdAt", ["createdAt"]),
});
