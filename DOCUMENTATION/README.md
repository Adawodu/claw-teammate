# dynoclaw Documentation

## Documents

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Tech stack, component map, integrations, and deployment topology |
| [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) | Module responsibilities, data flow, configuration, and API surface |
| [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) | ADR-style log of architectural decisions (DD-001 … DD-023) |
| [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) | Planned product direction and milestones |

## Diagrams (Mermaid)

| Diagram | Description |
|---------|-------------|
| [diagrams/architecture.md](diagrams/architecture.md) | C4-style container diagram showing GCP, OpenClaw, and external services |
| [diagrams/sequences.md](diagrams/sequences.md) | Sign-in, deploy, billing, Telegram, cost, teardown, and Mission Control approval flows |
| [diagrams/erd.md](diagrams/erd.md) | Convex schema: core platform, Mission Control, job search, agent memory |

## Project Summary

**dynoclaw** is a multi-tenant platform for deploying AI assistants as OpenClaw gateways on per-user GCP Compute Engine VMs. A Next.js dashboard on Vercel handles auth (Clerk), billing (Stripe), and VM provisioning; a Convex backend (34 tables) holds all state. Agents communicate via Telegram, route requests through OpenRouter (free tier) with Anthropic Claude fallback, and extend through 16 plugins and 23 skills. Side effects on external systems are human-in-the-loop: Gmail drafts and GitHub PRs only, plus the Mission Control propose/approve action queue.
