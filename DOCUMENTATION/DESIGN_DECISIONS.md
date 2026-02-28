# Design Decisions

### DD-001: Use OpenClaw as Gateway Framework
**Date**: 2026-02-15
**Status**: Accepted
**Context**: Needed a way to connect Telegram with AI models, manage credentials, and handle message routing without building custom infrastructure.
**Decision**: Use OpenClaw (npm package) as the gateway framework, installed globally on the VM.
**Consequences**: Reduced custom code to near-zero (only infra scripts). Tied to OpenClaw's release cycle and feature set. Upgrades require redeployment.

### DD-002: Single VM with No Public IP
**Date**: 2026-02-15
**Status**: Accepted
**Context**: The gateway only needs outbound internet (Telegram API, model APIs) and SSH access for administration.
**Decision**: Deploy on a single e2-small VM with `--no-address` (no external IP). Access via IAP SSH tunnels only.
**Consequences**: Strong security posture — no attack surface from internet. Requires IAP tunnel for dashboard access. Outbound traffic uses Cloud NAT.

### DD-003: Secrets in GCP Secret Manager
**Date**: 2026-02-15
**Status**: Accepted
**Context**: Multiple API keys and tokens needed at runtime. Cannot store in code per project policy.
**Decision**: Store all secrets in GCP Secret Manager; fetch at boot via service account with `secretmanager.secretAccessor` role.
**Consequences**: Secrets never touch the repo. Rotation requires updating Secret Manager + VM restart. Service account must have correct IAM bindings.

### DD-004: Model Fallback Chain (Free-First)
**Date**: 2026-02-15
**Status**: Accepted
**Context**: Want to minimize API costs while maintaining quality.
**Decision**: Primary model is OpenRouter free-tier; fallback is a paid model (Anthropic/OpenAI). Users can customize in deploy wizard.
**Consequences**: Most requests served at zero cost. Degraded latency on fallback. Quality difference between primary and fallback models.

### DD-005: Draft-Only and PR-Only Integration Policy
**Date**: 2026-02-15
**Status**: Accepted
**Context**: AI assistant should not take irreversible actions on external services.
**Decision**: Gmail/Beehiiv/social integrations create drafts only. GitHub integration creates PRs only (no merge).
**Consequences**: Human review required before any external-facing action. Slower workflow but eliminates risk of unintended publishes or merges.

### DD-006: Clerk for Authentication
**Date**: 2026-02-18
**Status**: Accepted
**Context**: Dashboard needs user authentication with Google OAuth. Evaluated Clerk, Auth0, NextAuth, and Convex Auth.
**Decision**: Use Clerk with Google OAuth as the sole sign-in method. Clerk also stores Google OAuth refresh tokens, which API routes use to call GCP REST APIs on behalf of users.
**Consequences**: Turnkey auth with minimal code. Clerk's OIDC provider integrates natively with Convex (automatic JWT validation). Google OAuth tokens are managed by Clerk — no custom token refresh logic. Trade-off: dependency on Clerk's free tier limits and pricing.

### DD-007: Keep Clerk (Reject Convex Auth Migration)
**Date**: 2026-02-25
**Status**: Accepted
**Context**: Evaluated migrating from Clerk to Convex Auth to eliminate Clerk dependency and reduce costs. Convex Auth would use built-in Google OAuth with a shared GCP service account.
**Decision**: Keep Clerk. The migration scope (~20 files, data migration, new auth patterns) outweighs the benefits. Clerk's Google OAuth token storage is actively used for per-user GCP operations. A service account approach would change the security model (shared credentials vs. per-user).
**Consequences**: Continued dependency on Clerk pricing. Simpler architecture — no migration risk or data integrity concerns. Per-user GCP tokens provide fine-grained audit trails.

### DD-008: Convex as Backend Database
**Date**: 2026-02-18
**Status**: Accepted
**Context**: Needed a backend for user data, deployment records, subscriptions, and CMS content. Evaluated Convex, Supabase, PlanetScale, and Firebase.
**Decision**: Use Convex for all application state. 13 tables covering users, deployments, subscriptions, plugins, skills, API keys, costs, media, knowledge, and CMS content.
**Consequences**: Real-time reactivity built in (automatic UI updates on data changes). Serverless functions (queries, mutations, actions) co-located with schema. TypeScript end-to-end. Trade-off: vendor lock-in, no raw SQL access.

### DD-009: Stripe for Billing
**Date**: 2026-02-20
**Status**: Accepted
**Context**: Need subscription billing with trial periods for the SaaS dashboard.
**Decision**: Use Stripe with Checkout sessions, webhook-driven subscription sync, and Customer Portal for self-service.
**Consequences**: Industry-standard billing. Webhook pattern keeps Convex as source of truth for subscription status. 14-day auto-trial on first sign-up reduces friction. Portal eliminates custom billing UI.

### DD-010: Multi-Tenant GCP VMs (One VM Per User)
**Date**: 2026-02-18
**Status**: Accepted
**Context**: Each user needs their own AI agent with custom plugins, skills, API keys, and Telegram bot.
**Decision**: Provision a dedicated GCP VM per user deployment. Dashboard API routes call GCP REST APIs to manage VM lifecycle.
**Consequences**: Full isolation between users. Each VM runs its own OpenClaw instance with custom config. Trade-off: higher cost per user than shared infrastructure. VMs provisioned using user's Google OAuth token (via Clerk) for their own GCP project.

### DD-011: Plugin Object Export Pattern (Typebox Parameters)
**Date**: 2026-02-19
**Status**: Accepted
**Context**: OpenClaw expects a specific tool registration pattern. Initial attempts using `inputSchema`/`handler` caused "Cannot read properties of undefined" errors.
**Decision**: All plugins use object export with `register()` method. Tools use Typebox `Type.Object()` for `parameters` field (not `inputSchema`). See `plugins/postiz/index.ts` as canonical reference.
**Consequences**: Consistent plugin interface. Strict adherence required — any deviation breaks tool registration at runtime.

### DD-012: Skills as Markdown Prompts (No Code)
**Date**: 2026-02-19
**Status**: Accepted
**Context**: Need configurable AI workflows that can be scheduled (cron) or invoked on-demand.
**Decision**: Skills are pure Markdown files with YAML frontmatter. The AI agent reads the skill definition and follows instructions, using registered tools (from plugins) as needed.
**Consequences**: Zero-code skill creation — just write Markdown. Skills can reference any registered tool. Trade-off: less deterministic than coded workflows. Skill quality depends on prompt engineering.

### DD-013: Pin OpenClaw Version
**Date**: 2026-02-22 (updated 2026-02-27)
**Status**: Updated
**Context**: OpenClaw `2026.2.22-2` introduced a Telegram regression — polling never starts after gateway boot. Pinned to `2026.2.17`. Tested `2026.2.26` on 2026-02-27: Telegram polling works, WhatsApp listener active, delivery queue recovery functional. The `2026.2.26` release includes Telegram/DM allowlist runtime inheritance fixes that resolved the regression.
**Decision**: Pin to `2026.2.26`. Startup scripts use `openclaw@2026.2.26`. Continue pinning rather than using `@latest` to avoid future regressions.
**Consequences**: Unlocks new channel support (WhatsApp, Discord, Google Chat, Signal, etc.) for future integrations. Must still manually test before bumping the pinned version.

### DD-014: Lazy Stripe Client Initialization
**Date**: 2026-02-20
**Status**: Accepted
**Context**: Next.js edge runtime and serverless functions have constraints on module-scope initialization.
**Decision**: Stripe client initialized via lazy `getStripe()` singleton. `ConvexHttpClient` created inside route handlers, not at module scope.
**Consequences**: Avoids build-time errors and cold-start failures. Slightly more verbose code but reliable across all Next.js runtime contexts.

### DD-015: Google Drive via OAuth2 (Not Service Account)
**Date**: 2026-02-21
**Status**: Accepted
**Context**: Needed to store generated media (images/videos) in Google Drive. Service account approach initially used but discovered SA keys have 0 storage quota on personal Gmail.
**Decision**: Use OAuth2 refresh token flow for `adawodu27@gmail.com`. Store OAuth client ID, secret, and refresh token in GCP Secret Manager.
**Consequences**: Full Drive access under personal account. Requires manual refresh token setup. If token expires, media uploads to Drive will fail (Convex storage still works as primary).
