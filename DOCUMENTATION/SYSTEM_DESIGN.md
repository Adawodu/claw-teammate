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
| `schema.ts` | 13-table schema definition with indexes and validators |
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

### 3. Shared Library (`packages/shared/`)

TypeScript types and registries shared between dashboard and infrastructure.

| File | Responsibility |
|------|---------------|
| `src/plugins.ts` | `PLUGIN_REGISTRY`: metadata for all 7 plugins (required keys, optional keys) |
| `src/skills.ts` | `SKILL_REGISTRY`: metadata for all 6 skills (cron schedules, required plugins) |
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
| `image-gen` | Image generation (Google Imagen 4 + DALL-E 3), persists to Convex + Drive |
| `video-gen` | Video generation (Gemini Veo + Sora), persists to Convex + Drive |
| `convex-knowledge` | RAG knowledge store + vector search |
| `github` | Read code, create branches, commit, open PRs |
| `beehiiv` | Newsletter draft creation |
| `twitter-research` | Tweet search and trend research |

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
   - Create VM (e2-small, Debian 12, no public IP)
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
- `channels.telegram.dmPolicy`: `pairing`
- `channels.telegram.groupPolicy`: `disabled`
- `models.default`: User-selected primary model
- `models.fallbacks`: User-selected fallback chain
- `plugins`: Enabled plugins with config from GCP secrets

---

## Storage

| Store | Technology | Purpose |
|-------|-----------|---------|
| User data, deployments, subscriptions | Convex (cloud) | All application state |
| Generated media (images, videos) | Convex File Storage | Blob storage with proxy URLs |
| API keys (per-deployment) | GCP Secret Manager | Encrypted secret storage |
| OpenClaw state | Local filesystem (per-VM) | Agent memory, config, logs |
| Media backups | Google Drive (OAuth2) | Long-term storage (optional) |
