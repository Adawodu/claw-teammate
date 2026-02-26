# From a Bash Script to a SaaS Platform in 10 Days

A few weeks ago I shared how I built a secure AI teammate on a $15/month GCP VM. Draft-only emails, PR-only GitHub, free-tier models, no public IP. A single bash script deployed the whole thing.

That was the prototype. Here's what happened next.

I turned that deploy script into a full SaaS platform — a web dashboard where anyone can spin up their own AI teammate with a few clicks. No terminal. No GCP console. No YAML files.

The product is called DynoClaw. It's live at dynoclaw.com.

## What Changed

The original version was a personal tool. One VM, one user, one deploy script. To set it up you needed to clone a repo, configure GCP secrets manually, and run `bash deploy-openclaw.sh`. Great for me. Unusable for anyone else.

The new version is a multi-tenant platform. Here's the before and after:

**Before (v1 — February 15):**
```
You → clone repo → edit secrets → run bash script → one VM
```

**After (v2 — February 25):**
```
You → sign in with Google → pick plugins → enter API keys → click Deploy → your VM
```

Same security model underneath. Same locked-down VMs. Same draft-only guardrails. But now there's a product around it.

## The Architecture Jump

The original system was three things: a deploy script, a Convex database, and a VM. The new system has considerably more surface area:

```
┌─────────────────────────────────────────────────────────────────┐
│                          Users                                  │
│                (Browser)         (Telegram)                     │
└────────┬──────────────────────────────┬─────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────────────┐
│  Vercel          │          │  Per-User GCP VM        │
│  Next.js 14      │          │  OpenClaw Gateway       │
│  Dashboard       │          │  Plugins + Skills       │
│  Marketing Site  │          │  (loopback only)        │
│  API Routes      │          │                         │
└───┬─────┬───┬───┘          └──┬───────┬──────┬───────┘
    │     │   │                 │       │      │
    ▼     ▼   ▼                 ▼       ▼      ▼
  Clerk  Convex  Stripe      Secrets   AI     Telegram
  Auth   13 tbl  Billing     Manager   APIs   Bot API
```

Here's what I added and why.

### Authentication (Clerk)

Users sign in with Google via Clerk. Clerk does three jobs: manages sessions, issues JWTs that Convex validates, and — this is the clever part — stores each user's Google OAuth refresh token. When a user deploys a VM, the dashboard uses *their* Google token to call GCP APIs on their behalf. No shared service account for provisioning. Every deployment is authenticated to the user's own GCP project.

### Database (Convex, 13 tables)

The original project had two Convex tables (knowledge base + cost snapshots). The SaaS version has thirteen:

- **users** — synced from Clerk on first sign-in
- **deployments** — GCP VM records (project, zone, status, model config)
- **subscriptions** — Stripe subscription state
- **pluginConfigs / skillConfigs** — per-deployment plugin and skill settings
- **apiKeyRegistry** — masked API key records (for the dashboard UI)
- **deployJobs** — audit log of deploy/delete/start/stop operations
- **pricingPlans / cmsPages / navLinks** — CMS content for the marketing site
- **media** — AI-generated images and videos (stored in Convex file storage)
- **costSnapshots / openrouterActivity** — cost tracking (carried over from v1)
- **knowledge** — vector knowledge base (carried over from v1)

All of this runs on Convex's free tier.

### Billing (Stripe)

New users get a 14-day trial automatically — the middleware creates it on first dashboard visit. After that, Stripe Checkout handles subscriptions. A webhook syncs subscription state back to Convex. The middleware checks subscription status on every dashboard route and redirects expired users to the pricing page.

The billing integration is about 200 lines of code across four API routes. Stripe's Checkout and Customer Portal handle the UI. I didn't build a single billing page.

### Multi-Tenant VM Provisioning

This was the hardest part. The deploy wizard collects your configuration — which plugins to enable, which skills to schedule, which API keys to use, which AI models to prefer — and then a single API route provisions everything:

1. Enables GCP APIs on the user's project
2. Creates a service account with minimal permissions
3. Stores API keys in the user's Secret Manager
4. Creates firewall rules (IAP SSH only, deny all other ingress)
5. Creates Cloud NAT for outbound internet
6. Generates a startup script that embeds the full OpenClaw configuration
7. Creates the VM

The startup script is generated dynamically based on the user's choices. It downloads their selected plugins from GitHub, installs their selected skills, writes the OpenClaw config with their model preferences, and starts the gateway via systemd.

Every VM is fully isolated. Different GCP project, different service account, different secrets, different bot. The security model from v1 applies to every deployment, not just mine.

### Plugins and Skills

Seven plugins now, up from one:

| Plugin | What It Does |
|--------|-------------|
| **Postiz** | Schedule and publish social media posts (draft-only by default) |
| **Image Gen** | Google Imagen 4 + DALL-E 3, saved to Convex + Google Drive |
| **Video Gen** | Gemini Veo + Sora fallback, same storage pattern |
| **Knowledge Base** | Vector-search memory (RAG) via Convex |
| **GitHub** | Read repos, create branches, open PRs (no merge) |
| **Beehiiv** | Draft newsletter content |
| **Twitter Research** | Search tweets, analyze trends |

Six skills (AI workflows that run on cron schedules or on-demand):

| Skill | Schedule |
|-------|----------|
| Daily Briefing | Every day, 1pm UTC |
| Daily Posts | Every day, 1pm UTC |
| Content Engine | Every Monday |
| Newsletter Writer | Every Tuesday |
| Engagement Monitor | Every Friday |
| Job Hunter | On-demand |

Skills are pure Markdown — no code. The AI agent reads the instructions and uses whatever tools (plugins) are available. Adding a new skill means writing a Markdown file with a YAML frontmatter block.

### Deploy Presets

To make the deploy wizard less intimidating, I added presets:

- **Social Media Manager**: Postiz + image gen + video gen + knowledge base. Scheduled daily posts and weekly engagement reports.
- **Content Creator**: Everything above plus Beehiiv newsletters.
- **Full Stack**: All plugins, all skills.

Pick a preset, enter your API keys, click deploy.

## What I Kept

The core principles from v1 survived intact:

**Draft-only, PR-only.** Every integration that touches external services creates drafts, not final outputs. The AI prepares. You decide.

**No public IP.** Every VM — mine and every user's — has no external IP address. Outbound only via Cloud NAT. Admin access via IAP SSH tunnel.

**Secrets in a vault.** Every API key in GCP Secret Manager. Fetched at boot by a service account with exactly one IAM role.

**Free-tier-first models.** The default preset uses Gemini 2.5 Flash (free via OpenRouter) as the primary model with a paid fallback. Most requests cost nothing.

**Cost transparency.** The 6-hourly cost tracking cron from v1 still runs. The dashboard now shows per-model spend breakdowns, 30-day trends, and fallback cost analysis.

## What I Learned Building the SaaS Layer

**The deploy script was the easy part.** Provisioning a single VM with known configuration is straightforward. Provisioning arbitrary VMs with user-defined configuration across different GCP projects, with proper error handling and status tracking, is a different problem entirely.

**Middleware is where the product lives.** The subscription guard in Next.js middleware handles trial creation, subscription validation, and redirect logic. It's maybe 60 lines of code but it defines the entire user experience.

**Webhook-driven billing is the right pattern.** The Stripe webhook is the single source of truth for subscription state. The dashboard never asks Stripe "what's the current status?" — it reads from Convex, which is kept in sync by the webhook. This makes the billing system fast and resilient.

**CMS tables eliminate hardcoding.** Pricing plans, guide pages, and navigation links are all stored in Convex and editable from the admin panel. No code changes needed to update the marketing site.

**Health polling is surprisingly important.** After a user clicks "Deploy," they're staring at a status indicator. A React hook polls the GCP instance status every 10 seconds during transitions (provisioning → running) and every 60 seconds when stable. It pauses when the browser tab is hidden. Small detail, big impact on perceived quality.

## The Numbers

| Component | Technology | Cost |
|-----------|-----------|------|
| Dashboard hosting | Vercel | $0 (free tier) |
| Auth | Clerk | $0 (free tier) |
| Database (13 tables + vector search) | Convex | $0 (free tier) |
| Billing | Stripe | 2.9% + 30c per transaction |
| Per-user VM | GCP e2-small | ~$12/mo (paid by user) |
| AI models | OpenRouter free tier + paid fallback | ~$0-3/mo per user |
| Domain + DNS | Cloudflare | $0 |
| **Platform operating cost** | | **$0/month** |

The platform itself costs nothing to run. Revenue comes from subscriptions. Each user's GCP costs are on their own billing account. This is the advantage of building on free tiers that actually scale.

## What's Next

The foundation is solid. The next problems are growth problems: onboarding UX, plugin marketplace, team workspaces, usage analytics. The architecture supports all of these — Convex's real-time reactivity and Clerk's organization features give me a clear path.

But honestly? The most important thing hasn't changed since day one. The AI agent drafts. The human decides. Everything else is infrastructure in service of that principle.

---

*DynoClaw is live at dynoclaw.com. If you're building AI agent infrastructure or thinking about secure deployment patterns, I'd love to compare notes.*

**#BuildInPublic #AIAgents #SaaS #CloudArchitecture #SecurityByDesign #GCP #NextJS #Convex**
