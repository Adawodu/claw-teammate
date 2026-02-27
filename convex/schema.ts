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

  subscriptions: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    status: v.string(),
    plan: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),

  pricingPlans: defineTable({
    slug: v.string(),
    name: v.string(),
    priceAmountCents: v.number(),
    stripePriceId: v.optional(v.string()),
    description: v.string(),
    features: v.array(v.string()),
    highlighted: v.boolean(),
    sortOrder: v.number(),
    active: v.boolean(),
  }).index("by_slug", ["slug"]),

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

  // ── CMS tables ────────────────────────────────────────────────────

  cmsPages: defineTable({
    slug: v.string(),
    title: v.string(),
    body: v.string(),
    published: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: v.string(),
    status: v.string(),
    lastSeenAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_role", ["role"]),

  // ── Privacy / DynoClux tables ─────────────────────────────────────

  privacyRequests: defineTable({
    userId: v.optional(v.string()),
    senderEmail: v.string(),
    senderDomain: v.string(),
    requestType: v.union(v.literal("unsubscribe"), v.literal("data_deletion")),
    method: v.optional(v.string()),
    requestedAt: v.number(),
    deadline: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("complied"),
      v.literal("violated"),
    ),
    evidence: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_senderDomain", ["senderDomain"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_deadline", ["deadline"]),

  privacyViolations: defineTable({
    userId: v.optional(v.string()),
    requestId: v.id("privacyRequests"),
    senderEmail: v.string(),
    senderDomain: v.string(),
    violationType: v.union(v.literal("canspam"), v.literal("ccpa")),
    deadlineDate: v.number(),
    violationDate: v.number(),
    messageIds: v.array(v.string()),
    headers: v.optional(v.string()),
    status: v.union(
      v.literal("detected"),
      v.literal("notice_drafted"),
      v.literal("notice_sent"),
      v.literal("resolved"),
    ),
    noticeDraft: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_requestId", ["requestId"])
    .index("by_senderDomain", ["senderDomain"])
    .index("by_userId_status", ["userId", "status"]),

  inboxScans: defineTable({
    userId: v.optional(v.string()),
    scannedAt: v.number(),
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
  })
    .index("by_scannedAt", ["scannedAt"])
    .index("by_userId_scannedAt", ["userId", "scannedAt"]),

  actionQueue: defineTable({
    action: v.string(),
    senderEmail: v.string(),
    senderDomain: v.string(),
    params: v.optional(v.any()),
    status: v.string(),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_domain_action", ["senderDomain", "action"]),

  navLinks: defineTable({
    label: v.string(),
    href: v.string(),
    section: v.string(),
    placement: v.array(v.string()),
    sortOrder: v.number(),
    visible: v.boolean(),
    isExternal: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_section", ["section"])
    .index("by_visible", ["visible"]),
});
