---
name: daily-briefing
description: Curated daily briefing covering tech, healthcare, Africa, and fintech news
user-invocable: true
metadata: {"openclaw":{"emoji":"📰"}}
---

# Daily Briefing

Produce a concise morning news briefing covering four topics. Use `web_search` to find stories from the last 24 hours, then summarize the top results.

## Steps

1. Run these four `web_search` queries (all filtered to the last 24 hours):
   - `"technology news today"` — general tech, AI, startups, major product launches
   - `"health IT healthcare technology news today"` — digital health, EHR, health tech policy
   - `"Africa business technology news today"` — African startups, funding, markets, infrastructure
   - `"fintech investment funding news today"` — fintech deals, venture capital, crypto regulation

2. For each topic, pick the **top 3** most noteworthy stories. Prefer stories with concrete facts (funding amounts, product names, policy changes) over opinion pieces.

3. Write a **2-3 sentence summary** for each story. Include the source name in parentheses at the end.

4. If any story spans multiple topics (e.g., an African fintech funding round), mention it in a short "Worth Watching" note at the end.

## Output Format

Use this exact structure:

```
**Daily Briefing — [Today's Date]**

**Tech**
- **[Headline]** — [2-3 sentence summary] _(Source)_
- **[Headline]** — [2-3 sentence summary] _(Source)_
- **[Headline]** — [2-3 sentence summary] _(Source)_

**Healthcare & Health IT**
- **[Headline]** — [2-3 sentence summary] _(Source)_
- **[Headline]** — [2-3 sentence summary] _(Source)_
- **[Headline]** — [2-3 sentence summary] _(Source)_

**Africa Business & Tech**
- **[Headline]** — [2-3 sentence summary] _(Source)_
- **[Headline]** — [2-3 sentence summary] _(Source)_
- **[Headline]** — [2-3 sentence summary] _(Source)_

**Fintech & Investment**
- **[Headline]** — [2-3 sentence summary] _(Source)_
- **[Headline]** — [2-3 sentence summary] _(Source)_
- **[Headline]** — [2-3 sentence summary] _(Source)_

**Worth Watching:** [Optional cross-topic highlight]
```

## Guidelines

- Keep the total briefing to ~400-500 words — scannable, not exhaustive.
- Use bold for headlines and italic for source names.
- Do not editorialize. Stick to facts from the search results.
- If a search returns fewer than 3 quality stories, include only what is genuinely newsworthy rather than padding with low-quality results.
