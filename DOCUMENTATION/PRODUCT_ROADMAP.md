# Product Roadmap

## Vision

Turn dynoclaw into a paid product: a pre-configured AI teammate that users deploy in their own cloud. They bring their own API keys, own their infra, and their data stays with them.

---

## What's Built Today

### Infrastructure
- **GCP Compute Engine deployment** — fully automated via `infra/gcp/deploy-openclaw.sh`
- **Secrets management** — all credentials stored in GCP Secret Manager (API keys, OAuth tokens, service accounts)
- **Systemd service** — auto-restart, startup script, security audit on boot
- **Telegram channel** — DM pairing, loopback-only gateway (no public IP)
- **Model fallback chain** — Gemini Flash → Claude Sonnet → GPT-4o Mini (direct provider APIs)

### Plugins (5 built)
| Plugin | Tools | Description |
|--------|-------|-------------|
| **image-gen** | `image_generate`, `media_gallery` | Google Imagen 4 + DALL-E 3. Auto-persists to Convex + Google Drive |
| **video-gen** | `video_generate`, `video_status` | Google Veo 3.1 + Sora 2. Async polling, auto-persistence |
| **postiz** | `postiz_channels`, `postiz_create_post`, `postiz_list_posts`, `postiz_delete_post`, `postiz_analytics` | Social media management (Instagram, Facebook, LinkedIn) |
| **beehiiv** | Newsletter creation | Draft-only newsletter publishing |
| **convex-knowledge** | Knowledge base search + ingest | Vector-indexed knowledge store with embeddings |

### Skills (6 built)
| Skill | Schedule | Description |
|-------|----------|-------------|
| **daily-briefing** | Daily 1pm UTC | Morning briefing summary |
| **daily-posts** | Daily 1pm UTC | Social media content generation |
| **content-engine** | Weekly Mon 1am UTC | Content calendar planning |
| **newsletter-writer** | Weekly Tue 2pm UTC | Newsletter draft generation |
| **engagement-monitor** | Weekly Fri 6pm UTC | Social analytics review |
| **job-hunter** | Manual trigger | Job search automation |

### Data Layer (Convex)
| Table | Purpose |
|-------|---------|
| **knowledge** | Vector-indexed knowledge base (1536-dim embeddings) |
| **media** | Persistent image/video storage metadata with CDN URLs + Drive links |
| **costSnapshots** | API cost tracking snapshots |
| **openrouterActivity** | Per-model usage and token tracking |

### Media Persistence Pipeline
```
image_generate / video_generate
        │
        ▼  (after generation succeeds)
   persistMedia()
        │
        ├──► Convex: blob storage → permanent CDN URL
        │
        └──► Google Drive: OAuth2 upload → shareable link
        │
        ▼
   Response includes: convexUrl + driveUrl
```
- Convex file storage for permanent CDN URLs
- Google Drive (OAuth2 refresh token, adawodu27@gmail.com) for browsable archive
- Both backends optional — gracefully skipped if not configured

---

## Phase 1: Multi-Cloud CLI Installer

**Goal:** `npx create-dynoclaw` — interactive setup that provisions everything.

- Interactive wizard: pick cloud (GCP / AWS / DigitalOcean / Docker self-hosted)
- Guided API key setup (auto-opens browser for Gemini free tier, BotFather, etc.)
- Automates what `deploy-openclaw.sh` does today, but polished and multi-cloud
- Zero-to-running in under 10 minutes

## Phase 2: Deployment Targets

| Target | Approach | Status |
|--------|----------|--------|
| GCP Compute Engine | `deploy-openclaw.sh` — full automation with plugins, skills, cron | **Complete** |
| AWS EC2 / Lightsail | Equivalent provisioning script | Not started |
| DigitalOcean Droplet | Equivalent provisioning script | Not started |
| Docker Compose | Single `docker compose up` + `.env` file | Not started |
| Marketplace images | GCP Marketplace, AWS AMI, DO 1-Click | Not started |

## Phase 3: Revenue Model

**Core strategy: CLI installer + plugin marketplace**

- **Free tier:** Core deployment + basic plugins (knowledge base, daily briefing)
- **Paid plugins:** Premium integrations (Postiz social media, CRM, advanced analytics)
- **Paid skills:** Job hunting, content calendar, client outreach
- **Pro dashboard:** Remote bot management portal, usage analytics

### Monetization options to evaluate

| Model | Description | Notes |
|-------|-------------|-------|
| Plugin marketplace | Free core, paid premium plugins | Natural upsell, low barrier |
| License key | CLI checks license, unlocks features | Simple, predictable |
| Managed updates | Pay for auto-updates + support | Sticky, recurring |
| Usage tiers | Free for 1 bot, pay for multi-agent/team | Freemium funnel |

## Phase 4: Frictionless UX

Key friction points to solve:
1. Cloud project setup + secret management — automate entirely
2. API keys — guide users to free-tier keys during setup
3. Plugin config (Postiz URL, Convex, etc.) — interactive wizard
4. Telegram bot token — step-by-step with deep links to BotFather

## Open Questions

- Which cloud to prioritize after GCP?
- License enforcement approach (honor system vs. server-side validation)?
- Should the dashboard be self-hosted or a hosted SaaS?
- Pricing tiers and price points?
- Open-source core vs. source-available?

---

*Last updated: 2026-02-21*
