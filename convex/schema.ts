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
    securityMode: v.optional(v.union(v.literal("secured"), v.literal("full-power"))),
    telegramUserId: v.optional(v.string()),
    // Pinned OpenClaw version. When unset, deploys/updates use the latest npm stable.
    desiredOpenClawVersion: v.optional(v.string()),
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
    billingType: v.optional(v.union(
      v.literal("subscription"),
      v.literal("one_time"),
      v.literal("subscription_plus_setup"),
    )),
    priceAmountCents: v.number(),
    setupFeeCents: v.optional(v.number()),
    stripePriceId: v.optional(v.string()),
    stripeSetupPriceId: v.optional(v.string()),
    description: v.string(),
    features: v.array(v.string()),
    deliverables: v.optional(v.array(v.string())),
    ctaText: v.optional(v.string()),
    highlighted: v.boolean(),
    sortOrder: v.number(),
    active: v.boolean(),
  }).index("by_slug", ["slug"]),

  serviceOrders: defineTable({
    userId: v.string(),
    planId: v.id("pricingPlans"),
    planSlug: v.string(),
    stripeSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    amountCents: v.number(),
    status: v.union(
      v.literal("paid"),
      v.literal("in_progress"),
      v.literal("delivered"),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_stripeSessionId", ["stripeSessionId"]),

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

  // ── Marketing assets ──────────────────────────────────────────────

  marketingImages: defineTable({
    slot: v.string(),
    storageId: v.id("_storage"),
    url: v.string(),
    alt: v.string(),
    updatedAt: v.number(),
  }).index("by_slot", ["slot"]),

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
    .index("by_email", ["email"])
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

  // ── Kimi Memory / Claude Code Memory Tables ───────────────────────

  agentMemory: defineTable({
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
    context: v.object({
      projectPath: v.optional(v.string()),
      files: v.optional(v.array(v.string())),
      toolCalls: v.optional(v.array(v.string())),
    }),
    embedding: v.array(v.float64()),
    importance: v.number(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["type", "userId"],
    })
    .index("by_sessionId", ["sessionId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_projectPath", ["context.projectPath"]),

  agentSessions: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    summary: v.optional(v.string()),
    keyDecisions: v.array(
      v.object({
        decision: v.string(),
        reasoning: v.string(),
        files: v.array(v.string()),
      }),
    ),
    todosCompleted: v.array(v.string()),
    todosPending: v.array(
      v.object({
        task: v.string(),
        priority: v.number(),
      }),
    ),
    tokenUsage: v.object({
      input: v.number(),
      output: v.number(),
      costUsd: v.number(),
    }),
  })
    .index("by_userId_startedAt", ["userId", "startedAt"])
    .index("by_sessionId", ["sessionId"]),

  // ── Webinar / Lead Funnel Tables ────────────────────────────────

  webinarSlides: defineTable({
    webinarId: v.string(),
    order: v.number(),
    type: v.union(
      v.literal("cover"),
      v.literal("content"),
      v.literal("section"),
      v.literal("interactive"),
      v.literal("demo"),
      v.literal("cta"),
    ),
    title: v.string(),
    subtitle: v.optional(v.string()),
    bullets: v.optional(v.array(v.string())),
    speakerNotes: v.optional(v.string()),
    highlightBox: v.optional(v.string()),
    demoSteps: v.optional(v.array(v.string())),
    demoSpeakerNote: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    instruction: v.optional(v.string()),
    tableRows: v.optional(v.array(v.object({
      cells: v.array(v.string()),
    }))),
    tableHeaders: v.optional(v.array(v.string())),
    twoColumns: v.optional(v.object({
      left: v.object({ heading: v.string(), items: v.array(v.string()) }),
      right: v.object({ heading: v.string(), items: v.array(v.string()) }),
    })),
    presenterInfo: v.optional(v.object({
      name: v.string(),
      title: v.string(),
      subtitle: v.optional(v.string()),
      event: v.optional(v.string()),
    })),
    ctaButton: v.optional(v.object({
      label: v.string(),
      url: v.string(),
    })),
    showInPublic: v.boolean(),
    showDynoclawCta: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_webinarId", ["webinarId"])
    .index("by_webinarId_order", ["webinarId", "order"]),

  webinarLeads: defineTable({
    webinarId: v.string(),
    name: v.string(),
    email: v.string(),
    businessType: v.optional(v.string()),
    biggestChallenge: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_webinarId", ["webinarId"])
    .index("by_email", ["email"]),

  // ── Job Search Tables ───────────────────────────────────────────

  targetCompanies: defineTable({
    userId: v.optional(v.string()),
    name: v.string(),
    website: v.optional(v.string()),
    stage: v.optional(v.string()),
    size: v.optional(v.string()),
    industry: v.optional(v.string()),
    location: v.optional(v.string()),
    whyInterested: v.optional(v.string()),
    fundingHistory: v.optional(v.string()),
    recentNews: v.optional(v.string()),
    challenges: v.optional(v.string()),
    techStack: v.optional(v.string()),
    intelBrief: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_userId", ["userId"]),

  jobListings: defineTable({
    userId: v.optional(v.string()),
    companyId: v.optional(v.id("targetCompanies")),
    companyName: v.string(),
    title: v.string(),
    url: v.optional(v.string()),
    source: v.optional(v.string()),
    jdText: v.optional(v.string()),
    matchScore: v.optional(v.number()),
    matchReason: v.optional(v.string()),
    compensationRange: v.optional(v.string()),
    remote: v.optional(v.boolean()),
    location: v.optional(v.string()),
    status: v.string(),
    appliedAt: v.optional(v.number()),
    responseAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_companyId", ["companyId"])
    .index("by_userId", ["userId"])
    .index("by_matchScore", ["matchScore"]),

  jobContacts: defineTable({
    userId: v.optional(v.string()),
    companyId: v.optional(v.id("targetCompanies")),
    jobId: v.optional(v.id("jobListings")),
    name: v.string(),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    connectionDegree: v.optional(v.string()),
    mutualConnections: v.optional(v.number()),
    relationship: v.string(),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    lastContactedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_companyId", ["companyId"])
    .index("by_jobId", ["jobId"])
    .index("by_relationship", ["relationship"])
    .index("by_userId", ["userId"]),

  jobOutreach: defineTable({
    userId: v.optional(v.string()),
    contactId: v.id("jobContacts"),
    jobId: v.optional(v.id("jobListings")),
    channel: v.string(),
    message: v.string(),
    status: v.string(),
    sentAt: v.optional(v.number()),
    repliedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_contactId", ["contactId"])
    .index("by_jobId", ["jobId"])
    .index("by_status", ["status"])
    .index("by_userId", ["userId"]),

  jobResumes: defineTable({
    userId: v.optional(v.string()),
    jobId: v.id("jobListings"),
    version: v.number(),
    tailoredResumeText: v.optional(v.string()),
    coverLetterText: v.optional(v.string()),
    talkingPoints: v.optional(v.array(v.string())),
    driveFileId: v.optional(v.string()),
    driveUrl: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_userId", ["userId"]),

  jobActivityLog: defineTable({
    userId: v.optional(v.string()),
    jobId: v.optional(v.id("jobListings")),
    companyId: v.optional(v.id("targetCompanies")),
    contactId: v.optional(v.id("jobContacts")),
    type: v.string(),
    details: v.string(),
    createdAt: v.number(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_companyId", ["companyId"])
    .index("by_userId", ["userId"])
    .index("by_createdAt", ["createdAt"]),

  // ── Mission Control (cross-context cockpit) ───────────────────────
  // Generalizes the dynoclux canvas pattern (canvas → Convex → agent
  // action queue → human approval) into workspaces/tasks/actions.
  // Single-user (jonnymate) today; userId optional so multi-tenant is a
  // later filter, not a rewrite. Cognitive Stack mapping:
  //   workspaces = Synapse · mcTasks = Maru ·
  //   mcActions + mcApprovalPolicy = Nzube (the driver's seat) ·
  //   mcActivity = CFP.

  workspaces: defineTable({
    userId: v.optional(v.string()),
    slug: v.string(),
    name: v.string(),
    kind: v.union(
      v.literal("marketing"),
      v.literal("lead_management"),
      v.literal("book"),
      v.literal("other"),
    ),
    emoji: v.optional(v.string()),
    description: v.optional(v.string()),
    agent: v.optional(v.string()), // "main" | "growth" (GrowthClaw) | ...
    archived: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_userId", ["userId"]),

  mcTasks: defineTable({
    userId: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    title: v.string(),
    detail: v.optional(v.string()),
    status: v.union(
      v.literal("backlog"),
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("blocked"),
      v.literal("done"),
    ),
    priority: v.optional(v.number()), // 0=low .. 3=urgent
    order: v.number(),
    origin: v.union(v.literal("human"), v.literal("agent")),
    assignedAgent: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  // The approval queue — the heart of "stay in the driver's seat".
  mcActions: defineTable({
    userId: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    taskId: v.optional(v.id("mcTasks")),
    type: v.string(), // "post_publish" | "email_send" | "crm_update" | "image_generate" | ...
    summary: v.string(),
    payload: v.optional(v.any()),
    state: v.union(
      v.literal("proposed"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
    ),
    gate: v.union(v.literal("auto"), v.literal("gated")),
    proposedByAgent: v.optional(v.string()),
    decidedBy: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_state", ["workspaceId", "state"])
    .index("by_state", ["state"]),

  // Per-workspace, per-action-type: auto-run or require approval.
  mcApprovalPolicy: defineTable({
    userId: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    actionType: v.string(),
    gate: v.union(v.literal("auto"), v.literal("gated")),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "actionType"]),

  mcActivity: defineTable({
    userId: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    kind: v.union(
      v.literal("message"),
      v.literal("tool"),
      v.literal("reasoning"),
      v.literal("system"),
    ),
    text: v.string(),
    agent: v.optional(v.string()),
    refActionId: v.optional(v.id("mcActions")),
    refTaskId: v.optional(v.id("mcTasks")),
    createdAt: v.number(),
  })
    .index("by_workspace_createdAt", ["workspaceId", "createdAt"]),
});
