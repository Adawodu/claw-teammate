---
name: content-engine
description: Weekly content calendar generator for LinkedIn, X, and newsletter
user-invocable: true
metadata: {"openclaw":{"emoji":"🗓️"}}
---

# Content Engine

Generate a 7-day content calendar (Mon–Sun) with platform assignments for LinkedIn, X, and newsletter topics. Research current trends and pull past engagement insights to inform the plan.

## Steps

1. **Research trends** — Run these 5 `web_search` queries:
   - `"healthcare technology trends this week"` — health IT, digital health, EHR innovations
   - `"AI startups funding news this week"` — AI companies, raises, product launches
   - `"Africa tech business news this week"` — African startups, markets, infrastructure
   - `"fintech payments news this week"` — fintech deals, crypto regulation, payments
   - `"software engineering leadership trends"` — engineering management, developer experience, career growth

2. **Pull engagement insights** — Call `knowledge_search` with query `"engagement insights top performing content"` and tags `["engagement-insights"]`. Note which topics and formats performed best.

3. **Pull last week's calendar** (if exists) — Call `knowledge_search` with query `"content calendar"` and tags `["content-calendar"]`. Avoid repeating the same topics.

4. **Generate calendar** — For each day Mon–Sun, assign:
   - **Platform**: LinkedIn, X, or both
   - **Topic**: A specific angle derived from research (not generic)
   - **Format**: Post type (story, thread, hot take, how-to, listicle, question)
   - **Key points**: 2-3 bullet points of what to cover
   - **Hook idea**: A compelling opening line

   Distribution rules:
   - LinkedIn: 3-4 posts/week (Tue, Wed, Thu preferred)
   - X: 4-5 posts/week (daily is fine, threads on Mon/Thu)
   - At least 1 day has both platforms
   - Weekend (Sat/Sun): lighter content or skip

5. **Store to knowledge base** — Call `knowledge_store` with:
   - `title`: `"Content Calendar — Week of [Monday date]"`
   - `content`: The full calendar in structured format
   - `tags`: `["content-calendar", "week-YYYY-WW"]` (use ISO week number)

6. **Report to user** — Present the calendar in a readable format.

## Output Format

```
**Content Calendar — Week of [Date]**

**Monday [Date]**
- Platform: X (thread)
- Topic: [Specific angle]
- Key points: [bullets]
- Hook: "[Opening line]"

**Tuesday [Date]**
- Platform: LinkedIn
- Topic: [Specific angle]
- Key points: [bullets]
- Hook: "[Opening line]"

[... continue for each day ...]

**Themes this week:** [2-3 overarching themes]
**Newsletter angle (Tue):** [Suggested newsletter topic based on the week's content]
```

## Guidelines

- Every topic must be specific and timely — no generic "AI is changing everything" posts.
- Vary formats across the week. Don't do 5 "how-to" posts in a row.
- Weight topics toward what performed well in past engagement data.
- If engagement data shows a topic underperformed, either skip it or try a different format.
- The Tuesday newsletter angle should synthesize 2-3 of the week's topics into a cohesive narrative.
