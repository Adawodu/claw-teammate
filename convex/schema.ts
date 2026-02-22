import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  knowledge: defineTable({
    text: v.string(),
    tags: v.array(v.string()),
    source: v.string(),
    createdAt: v.number(),
    embedding: v.array(v.float64()),
    userId: v.optional(v.string()),
  })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["tags"],
    })
    .index("by_userId", ["userId"]),

  costSnapshots: defineTable({
    fetchedAt: v.number(),
    openrouterBalance: v.number(),
    openrouterUsed30d: v.number(),
    openaiCostToday: v.number(),
    openaiCostMtd: v.number(),
    gcpEstimateMo: v.number(),
    error: v.optional(v.string()),
    userId: v.optional(v.string()),
  })
    .index("by_fetchedAt", ["fetchedAt"])
    .index("by_userId_fetchedAt", ["userId", "fetchedAt"]),

  openrouterActivity: defineTable({
    date: v.string(),
    model: v.string(),
    usageUsd: v.number(),
    requests: v.number(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    reasoningTokens: v.number(),
    lastUpdated: v.number(),
    userId: v.optional(v.string()),
  })
    .index("by_date", ["date"])
    .index("by_date_model", ["date", "model"])
    .index("by_userId_date", ["userId", "date"]),

  media: defineTable({
    storageId: v.id("_storage"),
    type: v.string(),
    prompt: v.string(),
    provider: v.string(),
    mimeType: v.string(),
    driveUrl: v.optional(v.string()),
    driveFileId: v.optional(v.string()),
    createdAt: v.number(),
    userId: v.optional(v.string()),
  })
    .index("by_type", ["type"])
    .index("by_createdAt", ["createdAt"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  // ── New tables for dashboard ──────────────────────────────────────

  deployments: defineTable({
    userId: v.string(),
    status: v.string(),
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
    deployedAt: v.number(),
    lastHealthCheck: v.optional(v.number()),
    lastHealthStatus: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"]),

  pluginConfigs: defineTable({
    userId: v.string(),
    deploymentId: v.id("deployments"),
    pluginId: v.string(),
    enabled: v.boolean(),
    config: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_deploymentId", ["deploymentId"])
    .index("by_userId", ["userId"]),

  skillConfigs: defineTable({
    userId: v.string(),
    deploymentId: v.id("deployments"),
    skillId: v.string(),
    enabled: v.boolean(),
    cronOverride: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_deploymentId", ["deploymentId"])
    .index("by_userId", ["userId"]),

  apiKeyRegistry: defineTable({
    userId: v.string(),
    deploymentId: v.id("deployments"),
    secretName: v.string(),
    maskedValue: v.string(),
    createdAt: v.number(),
    rotatedAt: v.optional(v.number()),
  })
    .index("by_deploymentId", ["deploymentId"])
    .index("by_userId", ["userId"]),

  deployJobs: defineTable({
    userId: v.string(),
    deploymentId: v.id("deployments"),
    status: v.string(),
    action: v.string(),
    config: v.optional(v.any()),
    log: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_deploymentId", ["deploymentId"])
    .index("by_userId_status", ["userId", "status"]),
});
