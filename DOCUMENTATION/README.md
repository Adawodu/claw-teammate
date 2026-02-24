# dynoclaw Documentation

## Documents

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Tech stack, component map, integrations, and deployment topology |
| [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) | Module responsibilities, data flow, configuration, and API surface |
| [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) | ADR-style log of architectural decisions |

## Diagrams (Mermaid)

| Diagram | Description |
|---------|-------------|
| [diagrams/architecture.md](diagrams/architecture.md) | C4-style container diagram showing GCP, OpenClaw, and external services |
| [diagrams/sequences.md](diagrams/sequences.md) | Deployment and Telegram message flow sequences |
| [diagrams/erd.md](diagrams/erd.md) | Configuration entity relationships |

## Project Summary

**dynoclaw** is an AI assistant deployed as an OpenClaw gateway on a single GCP Compute Engine VM. It communicates via Telegram, routes requests through OpenRouter (free tier) with Anthropic Claude fallback, and integrates with Gmail, GitHub, and Beehiiv in a safe, human-in-the-loop manner (drafts and PRs only).
