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
**Date**: 2026-02-22 (updated 2026-02-27, version bumped to 2026.4.8 on 2026-04-10)
**Status**: Updated
**Context**: OpenClaw `2026.2.22-2` introduced a Telegram regression — polling never starts after gateway boot. Pinned to `2026.2.17`. Tested `2026.2.26` on 2026-02-27: Telegram polling works, WhatsApp listener active, delivery queue recovery functional. The `2026.2.26` release includes Telegram/DM allowlist runtime inheritance fixes that resolved the regression.
**Decision**: Pin to `2026.4.8` (current). Startup scripts use `openclaw@2026.4.8`. Continue pinning rather than using `@latest` to avoid future regressions.
**Consequences**: Unlocks new channel support (WhatsApp, Discord, Google Chat, Signal, etc.) for future integrations. Must still manually test before bumping the pinned version.

### DD-014: Lazy Stripe Client Initialization
**Date**: 2026-02-20
**Status**: Accepted
**Context**: Next.js edge runtime and serverless functions have constraints on module-scope initialization.
**Decision**: Stripe client initialized via lazy `getStripe()` singleton. `ConvexHttpClient` created inside route handlers, not at module scope.
**Consequences**: Avoids build-time errors and cold-start failures. Slightly more verbose code but reliable across all Next.js runtime contexts.

### DD-015: Auto-Upgrade OpenClaw on Existing VMs
**Date**: 2026-02-27
**Status**: Accepted
**Context**: When the pinned OpenClaw version is bumped, only newly provisioned VMs get it. Existing VMs skip the install block because the `/opt/openclaw/.installed` marker file already exists. Users had to manually SSH in to upgrade.
**Decision**: Add a version comparison block to all startup scripts that runs after the first-boot guard. On every boot, the script compares the installed version (`openclaw --version`) against the pinned `OPENCLAW_VERSION` constant and runs `npm install -g` if they differ. A dashboard "Upgrade VM" button triggers this by calling the existing `/api/gcp/update` route (regenerates startup script + hard resets VM). No SSH or new API routes needed.
**Consequences**: Version bumps propagate to existing VMs on next reboot or dashboard-triggered upgrade. Single source of truth for the version lives in `packages/shared/src/index.ts`. The `deploy-openclaw.sh` shell script hardcodes the version since it can't import from TypeScript.

### DD-016: Google Drive via OAuth2 (Not Service Account)
**Date**: 2026-02-21
**Status**: Accepted
**Context**: Needed to store generated media (images/videos) in Google Drive. Service account approach initially used but discovered SA keys have 0 storage quota on personal Gmail.
**Decision**: Use OAuth2 refresh token flow for `adawodu27@gmail.com`. Store OAuth client ID, secret, and refresh token in GCP Secret Manager.
**Consequences**: Full Drive access under personal account. Requires manual refresh token setup. If token expires, media uploads to Drive will fail (Convex storage still works as primary).

### DD-017: Security Mode (Secured vs Full Power)
**Date**: 2026-04-17
**Status**: Accepted
**Context**: Customers need flexibility in how much autonomy their AI teammate has, but the platform must protect users by default and maintain admin visibility for liability.
**Decision**: Two security modes configurable at deploy time: Secured (default) enables Telegram pairing, exec approvals, and plugin approvals. Full Power disables all approvals and opens Telegram to all users. The choice is persisted in Convex and visible to admins.
**Consequences**: Non-technical users get safe defaults. Power users get full autonomy. Admins can see each user's security posture for advisory. Mode is changeable via Settings page.

### DD-018: Per-VM Secret Namespacing with IAM Conditions
**Date**: 2026-04-17
**Status**: Accepted
**Context**: In the managed GCP project, multiple customers' VMs share the same Secret Manager. Previously, VMs had project-wide secretAccessor role, meaning any VM could read any secret.
**Decision**: Secrets are namespaced as `<vmname>--<secretname>`. IAM conditions scope each VM's service account to only access secrets prefixed with its own name. A second condition allows access to non-namespaced (global) secrets for backward compatibility.
**Consequences**: Cross-tenant secret access eliminated. Legacy secrets still accessible. Slight IAM policy complexity increase.

### DD-019: Cloud Build Auto-Deploy for Tunnel Broker
**Date**: 2026-04-17
**Status**: Accepted
**Context**: The tunnel broker on Cloud Run required manual `gcloud run deploy` after every code change. Easy to forget, causing production to drift from main.
**Decision**: GCP Cloud Build trigger watches `services/tunnel-broker/**` on the main branch. On change, it builds the Docker image, pushes to Artifact Registry, and deploys to Cloud Run automatically.
**Consequences**: Zero-touch deploys for the broker. Dashboard still deploys via Vercel (separate pipeline). Build logs visible in GCP Console.

### DD-020: Remove Legacy Unauthenticated Access
**Date**: 2026-04-17
**Status**: Accepted
**Context**: Early Convex queries used `resolveUserWithLegacy` which returned ownerless data for unauthenticated requests (pre-multi-tenant pattern from when Jonnymate was the only user).
**Decision**: Replaced all `resolveUserWithLegacy` calls with `requireUser`. All Convex queries now require authentication. No more `__legacy__` sentinel or unauthenticated data access.
**Consequences**: Stronger security posture. Any remaining unauthenticated canvas/VM calls will fail until migrated. Legacy data without userId is only accessible via admin queries.

### DD-021: Mission Control as a Propose/Approve Action Queue
**Date**: 2026-09-04
**Status**: Accepted
**Context**: Agents running across several workspaces (marketing, lead management, book) needed to perform real side effects — publishing posts, sending email, writing to CRM — but an agent acting unilaterally on external systems is unrecoverable when it is wrong.
**Decision**: Agents never execute side effects directly. They write a proposal into `mcActions` via the `mission-control` plugin's `mc_propose_action`. A per-workspace, per-action-type `mcApprovalPolicy` row decides whether the action auto-runs (`auto`) or parks for human approval (`gated`). Approved actions move through an explicit `running → done | failed` lifecycle, and every transition is mirrored into an append-only `mcActivity` stream.
**Consequences**: Gated actions add latency and require a human in the loop, and the agent must poll for approvals rather than acting inline. In exchange, every external effect has a reviewable proposal, an attributable decision (`decidedBy`/`decidedAt`), and a full audit trail. Policies can be relaxed per action type as trust builds, without changing agent code.

### DD-022: Workspaces as the Unit of Agent Context
**Date**: 2026-09-04
**Status**: Accepted
**Context**: Tasks, actions, and activity from unrelated efforts were competing in one flat namespace, and different agents (main, GrowthClaw) needed separate operating contexts.
**Decision**: Introduce `workspaces` as the top-level container. Every task, action, approval policy, and activity row carries a `workspaceId`; a workspace optionally binds to a specific agent and declares a `kind`. Convex indexes are workspace-scoped (`by_workspace_status`, `by_workspace_state`, `by_workspace_createdAt`) so queries never scan across contexts.
**Consequences**: Cross-workspace views require fan-out rather than a single query, and every write path must supply a workspace. In return, approval policy can differ per context (auto-post in marketing, gate everything in lead management) and the cockpit UI can render one context at a time without filtering client-side.

### DD-023: Resolve OpenClaw Versions from the npm Registry at Runtime
**Date**: 2026-09-04
**Status**: Accepted
**Context**: `OPENCLAW_VERSION` was a hardcoded constant, so every version bump required a code change and a redeploy, and every VM was forced onto the same version. There was no way to pin one customer to a known-good release or roll a single deployment forward.
**Decision**: Resolve the version at request time, by precedence: an explicit pin from the caller, else the deployment's `desiredOpenClawVersion` (new field on `deployments`), else the latest stable from the npm registry via `packages/dashboard/lib/openclaw-versions.ts` and `/api/openclaw-versions` (5-minute in-process cache, 300s route revalidate, pre-releases filtered). `OPENCLAW_VERSION` is demoted to an **offline fallback** and the version baked into `create-dynoclaw` templates — it is no longer what installs.
**Consequences**: Registry availability becomes a soft dependency of deploys and of the settings page, which must tolerate a 502. Because installs now track `latest`, the boot-time upgrade check had to become non-destructive — see DD-024.

### DD-024: Auto-Update Weekly, and Never Downgrade on Boot
**Date**: 2026-09-04
**Status**: Accepted
**Context**: VMs should stay on the latest stable OpenClaw, but the startup script installed whatever version was baked into it whenever the installed version *differed* — including older. Once anything updated a VM out of band, the next reboot would drag it back. A live VM was found running 2026.6.1 with metadata pinning 2026.4.25, one reboot away from a two-month downgrade.
**Decision**: Two halves, both required. A weekly systemd timer (`openclaw-update.timer`, Sun 04:00 UTC, 30-minute jitter, `Persistent=true`) runs OpenClaw's own updater. The boot-time check compares with `sort -V` and only ever moves **forward**, so an explicit pin still upgrades a stale VM while an auto-updated one is left alone.
**Consequences**: A VM can now be ahead of the version its startup script names, which is intended. Jitter avoids a fleet stampeding npm. The risk this introduces is that a plugin-API change can arrive silently through an update — exactly how the `contracts.tools` regression (DD-025) went unnoticed for three months — so `openclaw plugins doctor` belongs in the post-update routine.

### DD-025: Plugin Manifests Must Declare `contracts.tools`
**Date**: 2026-09-04
**Status**: Accepted (forced by upstream)
**Context**: Every custom plugin had silently stopped exposing tools to the agent. `openclaw plugins doctor` reported the same line for all sixteen: *plugin must declare contracts.tools before registering agent tools*. The plugins still loaded, still reported `enabled`, still appeared in the gateway's "Enabled extension plugins" line — and none of their tools reached the model. Nothing errored. It presented as the model being bad at tool use. Introduced by the upgrade to OpenClaw 2026.6.1 in June and undetected for roughly three months.
**Decision**: Every `openclaw.plugin.json` declares the tool names its `index.ts` registers, plus `activation.onStartup`. Tool availability is verified by making the agent **call** a tool, never by asking it what tools it has — during diagnosis it twice reported "NONE" for families it could in fact call.
**Consequences**: Adding a tool now means editing two files, and forgetting the manifest fails silently rather than loudly. `openclaw plugins doctor` is the only guard, so it runs after every upgrade. `image-gen` keeps its `image_generate` despite an identically-named built-in, because the custom one persists to Convex and Drive where the built-in only returns the image.
