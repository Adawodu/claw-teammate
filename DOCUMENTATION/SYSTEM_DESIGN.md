# System Design

## Core Modules

### 1. Dashboard (`packages/dashboard/`)

Next.js 14 App Router application hosted on Vercel.

| Directory | Responsibility |
|-----------|---------------|
| `app/(marketing)/` | Landing page: hero, features, how-it-works, pricing, social proof |
| `app/(dashboard)/` | Authenticated pages: overview, deploy wizard, costs, media, admin |
| `app/(docs)/` | CMS-driven guide pages (markdown rendering from Convex) |
| `app/api/gcp/` | GCP VM lifecycle routes (deploy, delete, start/stop/reset, status, logs, secrets) |
| `app/api/billing/` | Stripe routes (create-checkout, webhook, create-portal, ensure-trial) |
| `components/` | Shared UI components (sidebar, marketing sections, dashboard widgets) |
| `hooks/` | Custom React hooks (useEnsureUser, useHealthPoll) |
| `lib/` | Server utilities (gcp-auth, gcp-rest, stripe, formatters) |

### 2. Convex Backend (`convex/`)

Serverless backend providing database, auth integration, and scheduled jobs.

| File | Responsibility |
|------|---------------|
| `schema.ts` | 34-table schema definition with indexes, vector index, and validators |
| `auth.config.ts` | Clerk OIDC provider configuration for Convex |
| `lib/auth.ts` | Auth helpers: requireUser, optionalUser, requireAdmin, requireDeploymentOwner |
| `users.ts` | User sync (touch from Clerk identity), admin user management |
| `deployments.ts` | CRUD for deployment records (GCP VM metadata) |
| `subscriptions.ts` | Subscription management (create trial, upsert from Stripe, query) |
| `pluginConfigs.ts` | Per-deployment plugin configurations |
| `skillConfigs.ts` | Per-deployment skill configurations |
| `apiKeyRegistry.ts` | Masked API key records per deployment |
| `deployJobs.ts` | Deploy job audit log (status tracking) |
| `costActions.ts` | 6-hourly cron: fetches OpenRouter + OpenAI usage data |
| `pricingPlans.ts` | CMS-managed pricing plans (public list, admin CRUD) |
| `cmsPages.ts` | CMS content pages (guide docs) |
| `navLinks.ts` | CMS navigation links |
| `media.ts` | Generated media records (images/videos with storage refs) |
| `knowledge.ts` | RAG knowledge base with vector search |
| `http.ts` | HTTP routes: cost dashboard, cost summary, storage proxy |
| `crons.ts` | Scheduled jobs (cost fetch every 6 hours) |
| `admin.ts` | Admin status check |
| `missionControl.ts` | Mission Control cockpit: workspaces, task board, approval-gated action queue, activity log |
| `jobSearch.ts` | Job hunt pipeline: target companies, listings, contacts, outreach, resumes, activity log |
| `dynoclux` tables via `privacyRequests.ts` / `privacyViolations.ts` / `inboxScans.ts` / `actionQueue.ts` | Privacy enforcement: inbox scans, unsubscribe/deletion requests, violation tracking, queued actions |
| `webinarSlides.ts` / `webinarLeads.ts` | Webinar deck content and lead capture |
| `marketingImages.ts` | Marketing image library (landing/testimonial assets) |
| `agentMemory.ts` | Agent long-term memory + session tracking (1536-dim embeddings, memory MCP server) |
| `serviceOrders.ts` | Done-for-you service order records |
| `mediaActions.ts` / `knowledgeActions.ts` | Actions for media persistence and knowledge ingestion |

### 3. Shared Library (`packages/shared/`)

TypeScript types and registries shared between dashboard and infrastructure.

| File | Responsibility |
|------|---------------|
| `src/plugins.ts` | `PLUGIN_REGISTRY`: metadata for all 17 plugins (required keys, optional keys) |
| `src/skills.ts` | `SKILL_REGISTRY`: metadata for all 21 skills (cron schedules, required plugins) |
| `src/presets.ts` | Deploy presets (social-media-manager, content-creator, full-stack) |
| `src/types.ts` | Shared TypeScript interfaces |

### 4. Infrastructure (`infra/gcp/`)

GCP provisioning scripts and configuration templates.

| File | Responsibility |
|------|---------------|
| `deploy-openclaw.sh` | Manual deploy script for master instance (gcloud CLI) |
| `startup.sh` | VM startup script template: installs Node, fetches secrets, configures OpenClaw |
| `openclaw.Dockerfile` | Container image definition (Node 22 + gcloud CLI + OpenClaw) |
| `openclaw-config.jsonc` | Config template with placeholder tokens |

### 5. Plugins (`plugins/`)

OpenClaw tool plugins that extend the AI agent's capabilities.

| Plugin | Key Functionality |
|--------|------------------|
| `postiz` | Social media posting/scheduling via Postiz API |
| `mission-control` | Cross-context cockpit tools: workspaces, task board, propose/execute approval-gated actions; ships the canvas UI |
| `memory-mcp` | MCP server exposing agent long-term memory (store/recall/search over Convex embeddings) |
| `image-gen` | Image generation (Google Imagen 4 + DALL-E 3), persists to Convex + Drive |
| `video-gen` | Video generation (Gemini Veo + Sora), persists to Convex + Drive |
| `convex-knowledge` | RAG knowledge store + vector search |
| `github` | Read code, create branches, commit, open PRs |
| `beehiiv` | Newsletter draft creation |
| `twitter-research` | Tweet search and trend research |
| `clarify-ai` | CRM: contact search, lead management, deal pipeline |
| `agentmail` | Dedicated agent email inbox (send/receive/list) |
| `carousel-gen` | HTML→PNG carousel and comic brief generator |
| `youtube-transcriber` | YouTube video transcript extraction |
| `job-search` | Job listing search and tracking |
| `web-tools` | Website crawling, PDF reading, file search |
| `dynoclux` | Privacy enforcement (inbox scanning, unsubscribe) |
| `dynosist` | Email assistant (Gmail drafts) |

`hubspot` and `zoho` still exist under `plugins/` but were **retired in favour of
`clarify-ai`** (PR #69): removed from `PLUGIN_REGISTRY`, disabled on the VM. Three CRMs
meant the model had to choose between `hubspot_search_contacts`, `zoho_search_contacts`
and `clarify_search` for one job. The directories stay until the disable has soaked.

**Every plugin manifest must declare `contracts.tools`.** Since OpenClaw ~2026.6.1, a
plugin whose `openclaw.plugin.json` omits it will load, report `enabled`, and register
no tools at all — silently. Detect with `openclaw plugins doctor`; run it after every
OpenClaw upgrade.

```json
{ "id": "convex-knowledge",
  "activation": { "onStartup": true },
  "contracts": { "tools": ["knowledge_search", "knowledge_store"] },
  "configSchema": { ... } }
```

### 6. Skills (`skills/`)

Markdown-defined AI workflows executed by the OpenClaw agent.

| Skill | Schedule | Purpose |
|-------|----------|---------|
| `daily-briefing` | Daily 1pm UTC | Web research briefing for user |
| `daily-posts` | Daily 1pm UTC | Generate and schedule social media content |
| `content-engine` | Weekly Mon 1am UTC | Research + store knowledge for content pipeline |
| `newsletter-writer` | Weekly Tue 2pm UTC | Draft newsletter from knowledge base |
| `engagement-monitor` | Weekly Fri 6pm UTC | Analyze social media performance |
| `job-hunter` | On-demand | Search and summarize relevant job postings |
| `growth-hacker` | On-demand | Growth strategy and marketing tactics |
| `product-update` | On-demand | Product changelog and update drafts |
| `agentmail` | On-demand | Email inbox management |
| `agent-browser` | On-demand | Browser automation tasks |
| `comic-brief` | On-demand | HTML comic brief generation |
| `crm-pipeline` | On-demand | CRM pipeline management |
| `metric-health-echo` | On-demand | System health monitoring |
| `company-intel` | On-demand | Company research and intelligence |
| `network-scan` | On-demand | Professional network analysis |
| `job-scout` | On-demand | Job market scanning |
| `agency-pack-sales` | On-demand | Sales agency pack (bundled skills) |
| `agency-pack-marketing` | On-demand | Marketing agency pack (bundled skills) |
| `agency-pack-engineering` | On-demand | Engineering agency pack (bundled skills) |

### 7. Tunnel Broker (`services/tunnel-broker/`)

Cloud Run service that proxies browser requests to per-user GCP VMs via IAP-for-TCP.

| Aspect | Detail |
|--------|--------|
| Runtime | Cloud Run (managed) |
| Auth | JWT with 5-minute TTL |
| Rate Limiting | 60 auth requests / 200 asset requests per minute per IP |
| Caching | Asset caching with single-tenant invariant |
| Deploy | Auto-deploys via Cloud Build trigger on main branch changes to `services/tunnel-broker/**` |

The broker eliminates the need for public IPs on user VMs. Browser-based tools (e.g., agent-browser) route through the broker, which authenticates via JWT and tunnels traffic to the target VM using IAP-for-TCP. The single-tenant invariant ensures cached assets are never served cross-tenant.

### 8. Mission Control (`plugins/mission-control/`, `convex/missionControl.ts`)

A cross-context cockpit that keeps the human in the driver's seat while agents work.

| Concept | Table | Role |
|---------|-------|------|
| Workspace | `workspaces` | Named context (marketing, lead_management, book, other), optionally bound to an agent |
| Task | `mcTasks` | Kanban card (backlog → todo → in_progress → blocked → done); `origin` records whether a human or agent created it |
| Action | `mcActions` | Proposed side effect (post_publish, email_send, crm_update, image_generate, …) with a lifecycle: proposed → approved/rejected → running → done/failed |
| Policy | `mcApprovalPolicy` | Per-workspace, per-action-type gate: `auto` (execute immediately) or `gated` (wait for approval) |
| Activity | `mcActivity` | Append-only stream of messages, tool calls, reasoning, and system events |

**Driver's-seat contract**: the agent never performs a side-effecting operation directly. It calls `mc_propose_action`, which writes an `mcActions` row. `mcApprovalPolicy` decides whether the action auto-runs or parks in the pending queue. The human approves or rejects from the canvas UI (served by the plugin at `/canvas/mission-control/`); only then does the agent call `startAction` → `completeAction`/`failAction`.

### 9. Job Search Pipeline (`plugins/job-search/`, `convex/jobSearch.ts`)

Five-table pipeline backing the `job-hunter`, `job-scout`, `company-intel`, and `network-scan` skills: `targetCompanies` → `jobListings` → `jobContacts` → `jobOutreach`, with `jobResumes` for tailored resume variants and `jobActivityLog` for audit.

---

## Data Flows

### Authentication Flow

1. User clicks "Sign in with Google" → Clerk Google OAuth
2. Clerk creates session, issues JWT
3. Next.js middleware validates session via `clerkMiddleware()`
4. For API routes: `auth()` from Clerk extracts userId
5. For Convex calls: Clerk issues a `"convex"` JWT template
6. `ConvexProviderWithClerk` automatically passes JWT to Convex client
7. Convex validates JWT against Clerk OIDC provider config
8. `requireUser(ctx)` extracts `identity.subject` (Clerk user ID)

### Subscription Guard Flow

1. Middleware detects dashboard route access
2. Fetches subscription from Convex via `ConvexHttpClient`
3. If no subscription → calls `/api/billing/ensure-trial` (auto-creates 14-day trial)
4. If subscription is `canceled`/`past_due` → redirects to `/#pricing`
5. Active statuses (`trialing`, `active`) → allow through

### Deploy Flow (Dashboard → GCP VM)

1. User completes deploy wizard (selects plugins, skills, enters API keys)
2. `POST /api/gcp/deploy` receives full config
3. `getGcpToken()` fetches Google OAuth token from Clerk + Convex JWT
4. API route provisions GCP resources:
   - Enable APIs (Compute, Secret Manager)
   - Create service account + IAM bindings
   - Store API keys as GCP secrets
   - Create firewall rules (IAP SSH only + deny-all)
   - Create Cloud NAT (router + NAT config)
   - Generate startup script (embeds full OpenClaw config)
   - Create VM (e2-medium, Debian 12, no public IP)
5. Save deployment record + configs to Convex
6. VM boots, startup script runs:
   - Install Node.js 22 + OpenClaw (first boot)
   - Fetch secrets from Secret Manager
   - Download plugins from GitHub
   - Download skill definitions from GitHub
   - Write OpenClaw config + auth profiles
   - Create systemd service + start gateway

### Billing Flow

1. **Trial start**: User signs up → middleware triggers `ensure-trial` → Stripe customer created → Convex subscription record (status: `trialing`, 14-day)
2. **Checkout**: User selects plan → `create-checkout` → Stripe Checkout session with trial → user completes payment
3. **Webhook**: Stripe fires `customer.subscription.created/updated/deleted` → webhook route verifies signature → `subscriptions.upsert` in Convex
4. **Portal**: User clicks "Manage Billing" → `create-portal` → Stripe Customer Portal URL

### Message Flow (Telegram → AI → Response)

1. User sends Telegram DM to bot
2. OpenClaw Telegram channel receives message (pairing-authenticated)
3. Gateway routes to primary model (via OpenRouter free tier)
4. On failure, falls back to configured fallback model
5. If model invokes a tool → plugin `execute()` runs
6. Response returned to Telegram

### Cost Tracking Flow

1. Convex cron fires every 6 hours → `fetchAndStoreCosts` action
2. Fetches OpenRouter credits + per-model usage via API
3. Fetches OpenAI organization costs via API
4. Writes snapshot to `costSnapshots` table
5. Upserts per-model/per-date rows to `openrouterActivity` table
6. Dashboard reads from both tables for charts + summaries

---

### Action Approval Flow (Mission Control)

1. Agent decides a side effect is needed → calls `mc_propose_action` with type, summary, payload.
2. `missionControl:proposeAction` looks up `mcApprovalPolicy` for `(workspaceId, actionType)`.
3. Gate `auto` → action is written as `approved` and the agent may execute immediately.
4. Gate `gated` → action is written as `proposed` and appears in the canvas pending queue.
5. Human calls `decideAction` (approve/reject) from the canvas.
6. On approval the agent polls `approvedActions`, calls `startAction` (→ `running`), performs the work, then `completeAction` (→ `done`, with result) or `failAction` (→ `failed`, with error).
7. Every step is mirrored into `mcActivity` via `logActivity`.

---

## API Surface

### Dashboard API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/gcp/deploy` | POST | Clerk + Google OAuth | Provision full GCP deployment |
| `/api/gcp/delete` | POST | Clerk + Google OAuth | Tear down VM + router, remove Convex record |
| `/api/gcp/vm` | POST | Clerk + Google OAuth | VM lifecycle (start/stop/reset) |
| `/api/gcp/status` | GET | Clerk + Google OAuth | VM status + metadata |
| `/api/gcp/logs` | GET | Clerk + Google OAuth | Serial port output (startup logs) |
| `/api/gcp/secrets` | POST | Clerk + Google OAuth | Create/update GCP secret |
| `/api/gcp/update` | POST | Clerk + Google OAuth | Regenerate startup script at pinned version and hard-reset VM (OpenClaw upgrade) |
| `/api/gcp/tunnel-token` | POST | Clerk + Google OAuth | Mint short-lived JWT for the tunnel broker |
| `/api/openclaw-versions` | GET | Public | Recent stable `openclaw` versions from the npm registry (5-min cache) |
| `/api/email/drafts` | GET/POST | Clerk | Gmail draft listing/creation for the dynosist flow |
| `/api/webinar/seed` | POST | Clerk (admin) | Seed webinar slide content |
| `/api/billing/create-checkout` | POST | Clerk | Create Stripe Checkout session |
| `/api/billing/webhook` | POST | Public (Stripe signature) | Handle Stripe subscription events |
| `/api/billing/create-portal` | POST | Clerk | Create Stripe Customer Portal session |
| `/api/billing/ensure-trial` | POST | Clerk | Idempotent trial creation |

### Convex HTTP Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/dashboard` | GET | None | HTML cost dashboard (for Telegram bot) |
| `/costs-summary` | GET | None | Plain text cost summary |
| `/storage/{id}.{ext}` | GET | None | Storage proxy with correct Content-Type |

---

## Configuration

### Environment Variables

**Vercel (Dashboard)**:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk frontend key
- `CLERK_SECRET_KEY` — Clerk backend key
- `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL
- `STRIPE_SECRET_KEY` — Stripe API key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signature secret
- `STRIPE_STARTER_PRICE_ID` / `STRIPE_PRO_PRICE_ID` — Price ID mappings
- `NEXT_PUBLIC_SITE_URL` — `https://dynoclaw.com`

**Convex Dashboard**:
- `ADMIN_USER_IDS` — Comma-separated Clerk user IDs for admin access
- `OPENROUTER_MGMT_KEY` — OpenRouter management API key (cost tracking)
- `OPENAI_ADMIN_KEY` — OpenAI admin API key (cost tracking)

### OpenClaw Config (Per-VM)

Written to `/root/.openclaw/openclaw.json` at boot:
- `gateway.bind`: `loopback` (no external access)
- `gateway.auth.token`: Random 32-byte hex (generated at deploy)
- `channels.telegram.enabled`: `true`
- `channels.telegram.dmPolicy`: `configurable (paired or open, based on security mode)`
- `channels.telegram.groupPolicy`: `disabled`
- `models.default`: User-selected primary model
- `models.fallbacks`: User-selected fallback chain
- `plugins`: Enabled plugins with config from GCP secrets

### Model routing

The reference deployment (`openclaw-vm`) routes everything through OpenRouter, so one
credential reaches every provider and models can be swapped without touching config
per-vendor:

| Role | Model |
|---|---|
| primary | `openrouter/anthropic/claude-sonnet-5` |
| fallbacks | `openrouter/google/gemini-3.8-flash` → `openrouter/openai/gpt-5.6-luna` |
| `reasoning` alias | `openrouter/anthropic/claude-opus-5` |
| `code` alias | `openrouter/anthropic/claude-sonnet-5` |
| `fast` alias | `openrouter/google/gemini-3.8-flash` |
| `cheap` alias | `openrouter/openai/gpt-5.6-luna` |

Operational notes:

- Provider plugins (`openrouter`, `ollama`, `lmstudio`) ship **with** OpenClaw but are
  disabled *and* excluded from `plugins.allow`. Add to the allowlist first, or
  `plugins enable openrouter` fails with "blocked by allowlist".
- Set credentials **before** the model. The fallback chain is also OpenRouter, so an
  unauthenticated provider fails every model at once, not just the primary.
- Model ids move. Claude 4.x ids no longer resolve on OpenRouter; check the live list
  (`https://openrouter.ai/api/v1/models`) rather than assuming a name still exists.
- Local Ollama is impractical on the current `e2-medium` (3.8 GB RAM, no GPU) — roughly
  1–3B quantized models only. Ollama Cloud or a resize would be required.

---

## Storage

| Store | Technology | Purpose |
|-------|-----------|---------|
| User data, deployments, subscriptions | Convex (cloud) | All application state |
| Generated media (images, videos) | Convex File Storage | Blob storage with proxy URLs |
| API keys (per-deployment) | GCP Secret Manager | Encrypted secret storage |
| OpenClaw state | Local filesystem (per-VM) | Agent memory, config, logs |
| Media backups | Google Drive (OAuth2) | Long-term storage (optional) |
