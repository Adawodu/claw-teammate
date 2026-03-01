---
name: product-update
description: Log product milestones and updates to the shared knowledge DB
user-invocable: true
metadata: {"openclaw":{"emoji":"🚀"}}
---

# Product Update

On-demand skill for logging product milestones, launches, and significant updates to the knowledge DB. These entries are consumed by growth-hacker, content-engine, daily-posts, and newsletter-writer to keep content grounded in real product progress.

## Steps

1. **Ask for details** — If not provided in the invocation, ask:

   > **Which product?**
   > ParallelScore | ShemShems | myir.io | withLoam | DynoClaw | Personal Brand
   >
   > **What type of update?**
   > - Launch (new feature, product, or version)
   > - Milestone (user count, revenue, partnership)
   > - Pivot (direction change, sunset, rebrand)
   > - Insight (lesson learned, user feedback pattern)

2. **Gather the update** — Ask the user to describe the update in 2-3 sentences. Prompt for:
   - What happened
   - Why it matters
   - Any metrics (numbers, dates, comparisons)

3. **Store to knowledge DB** — Call `knowledge_store` with:
   - `text`: `"PRODUCT UPDATE [product name] [today's date]: [Type] — [user's description]. Key metrics: [any numbers mentioned]."`
   - `tags`: `["product-update", "[product-name-lowercase]"]`

4. **Confirm** — Tell the user the update was stored and which skills will pick it up:

   > **Stored.** This update will be surfaced by:
   > - `/content-engine` — when planning next week's calendar
   > - `/daily-posts` — when drafting posts about this product
   > - `/newsletter-writer` — in the "What I'm building" section
   > - `/growth-hacker` — during audits and experiment design

## Guidelines

- Keep stored text under 200 words — this is a signal for other skills, not a blog post.
- Always include the product name and date in the prefix for reliable vector search.
- If the user provides the product and update inline (e.g. `/product-update DynoClaw launched plugin marketplace`), skip the questions and go straight to storage.
- Multiple updates can be logged in one session — after storing, ask "Any other updates?"
