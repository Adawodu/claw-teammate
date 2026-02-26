# Architecture

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Radix UI, Recharts |
| Auth | Clerk (Google OAuth, OIDC → Convex JWT) |
| Backend | Convex (serverless queries, mutations, actions, crons, storage) |
| Billing | Stripe (Checkout, Webhooks, Customer Portal) |
| Cloud Infra | GCP Compute Engine, Secret Manager, Cloud NAT, IAP |
| Gateway | OpenClaw (npm package, runs on per-user GCP VMs) |
| Messaging | Telegram Bot API (via OpenClaw channel) |
| AI Models | OpenRouter (free-tier primary), Anthropic, OpenAI, Google Gemini |
| CDN/Deploy | Vercel (dashboard hosting), Cloudflare DNS |
| Runtime | Node.js 22 (VMs), Edge Runtime (middleware) |

## High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│                         End Users                               │
│              (Browser)            (Telegram)                    │
└────────┬──────────────────────────────┬─────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────────────┐
│  Vercel (CDN)   │          │  Per-User GCP VM        │
│  Next.js 14     │          │  OpenClaw Gateway       │
│  Dashboard      │          │  (loopback:18789)       │
│  + API Routes   │          │  + Plugins + Skills     │
└───┬─────┬───┬───┘          └──┬───────┬──────┬───────┘
    │     │   │                 │       │      │
    ▼     ▼   ▼                 ▼       ▼      ▼
┌──────┐┌──────┐┌──────┐  ┌──────┐┌──────┐┌────────┐
│Clerk ││Convex││Stripe│  │Secret││Model ││External│
│Auth  ││DB    ││Bill. │  │Mgr   ││APIs  ││APIs    │
└──────┘└──────┘└──────┘  └──────┘└──────┘└────────┘
```

## Service Responsibilities

### Dashboard (Next.js on Vercel)
- Marketing pages (landing, pricing, docs)
- Deploy wizard (configure plugins, skills, API keys → provision GCP VM)
- Deployment management (start/stop/reset/delete VMs, view logs)
- Cost monitoring (OpenRouter + OpenAI + GCP usage)
- Media gallery (AI-generated images and videos)
- Admin panel (user management, CMS, pricing plans, nav links)
- Billing management (Stripe Checkout, subscription status, portal)

### Clerk (Authentication)
- Google OAuth sign-in/sign-up
- Session management (JWTs for Next.js middleware + API routes)
- OIDC provider for Convex (issues Convex-scoped JWTs)
- Stores Google OAuth refresh tokens (used for GCP API access per user)

### Convex (Backend Database + Functions)
- 13-table schema: users, deployments, subscriptions, plugins, skills, API keys, costs, media, knowledge, CMS, etc.
- Auth helpers (requireUser, requireAdmin, requireDeploymentOwner)
- Subscription management (create trial, upsert from Stripe webhook)
- Cost tracking (6-hourly cron fetches OpenRouter + OpenAI usage)
- HTTP routes (cost dashboard, storage proxy)
- Vector search (knowledge base with 1536-dim embeddings)

### Stripe (Billing)
- Subscription lifecycle (trial → active → canceled)
- Checkout sessions with 14-day trial
- Webhook events (subscription.created/updated/deleted)
- Customer portal for self-service billing management

### GCP (Per-User VM Infrastructure)
- Compute Engine VMs (e2-small, Debian 12, no external IP)
- Secret Manager (API keys stored per-project)
- Cloud NAT (outbound internet for VMs)
- IAP SSH tunnels (admin access)
- Service accounts (openclaw-sa with secretmanager.secretAccessor)

### OpenClaw Gateway (On-VM AI Agent)
- Telegram bot channel management
- AI model routing with fallback chains
- Plugin execution (tools for social media, content, GitHub, etc.)
- Skill execution (scheduled + on-demand AI workflows)
- Cron-based automation (daily posts, weekly newsletters, etc.)

## External Dependencies & Integrations

| Integration | Used By | Secret Name | Status |
|------------|---------|-------------|--------|
| Clerk | Dashboard auth | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Required |
| Convex | Dashboard backend | `NEXT_PUBLIC_CONVEX_URL` | Required |
| Stripe | Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Required |
| Telegram | OpenClaw channel | `telegram-bot-token` (GCP Secret) | Required |
| Anthropic | AI model fallback | `anthropic-api-key` (GCP Secret) | Required |
| OpenRouter | AI model primary | `openrouter-api-key` (GCP Secret) | Optional |
| Google/Gemini | Image/video gen | `gemini-api-key` (GCP Secret) | Optional |
| Postiz | Social media | `postiz-api-key` (GCP Secret) | Optional |
| GitHub | Code operations | `github-token` (GCP Secret) | Optional |
| Beehiiv | Newsletter | `beehiiv-api-key` (GCP Secret) | Optional |
| Google Drive | Media storage | OAuth2 refresh token (GCP Secret) | Optional |

## Deployment Topology

### Dashboard (Vercel)
- **URL**: `https://dynoclaw.com` (custom domain via Cloudflare)
- **Alias**: `https://dynoclaw.vercel.app`
- **Build**: Next.js static + serverless functions
- **Env vars**: Clerk keys, Convex URL, Stripe keys, GCP SA credentials

### Master VM (GCP — `jonny-mate` project)
- **VM**: `openclaw-vm` on e2-small, us-central1-a
- **Purpose**: Production instance (Bayo's daily-use agent)
- **Access**: IAP SSH only, no public IP
- **OpenClaw version**: Pinned to `2026.2.17`

### User VMs (GCP — per-user projects)
- **Provisioned by**: Dashboard deploy API route
- **Lifecycle**: Created on deploy, managed via dashboard (start/stop/reset/delete)
- **Networking**: No external IP, Cloud NAT for outbound, IAP SSH firewall rules
- **Plugins/Skills**: Downloaded from GitHub at boot, configured via startup script

## Operational Constraints (from CLAUDE.md)

- Draft-only for Gmail, Beehiiv, and social integrations
- PR-only for GitHub (no merge permissions)
- No secrets in code
- No destructive commands
