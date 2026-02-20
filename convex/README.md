# Convex Functions

Backend functions for the claw-teammate cost tracking dashboard and knowledge base.

## Modules

### `costs.ts` / `costActions.ts`
Cost tracking for API usage across providers.
- `fetchAndStoreCosts` — action that pulls usage data from OpenRouter and OpenAI APIs, stores per-model activity and snapshots
- `upsertActivity` — mutation to insert/update daily per-model usage records
- `storeSnapshot` — mutation to store a point-in-time cost summary

### `knowledgeActions.ts`
Knowledge base with semantic search (used by the convex-knowledge plugin).
- `ingest` — action to store text with tags and generate embeddings
- `search` — action to perform semantic similarity search

## Local Development

```bash
npx convex dev          # Start dev server + hot reload
npx convex dashboard    # Open the Convex dashboard
```

## Environment Variables

Set these in the Convex dashboard under Settings > Environment Variables:
- `OPENROUTER_MGMT_KEY` — OpenRouter management API key (for cost tracking)
- `OPENAI_ADMIN_KEY` — OpenAI admin API key (for cost tracking)
