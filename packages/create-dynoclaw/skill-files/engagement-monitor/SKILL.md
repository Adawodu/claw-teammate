---
name: engagement-monitor
description: Analyze social media engagement and store insights for future content
user-invocable: true
metadata: {"openclaw":{"emoji":"📊"}}
---

# Engagement Monitor

Analyze LinkedIn and X engagement from the past week, identify patterns, and store insights to the knowledge base for the content engine and newsletter writer.

## Steps

1. **Get channel info** — Call `postiz_channels` to get integration IDs for LinkedIn and X.

2. **Pull analytics** — Call `postiz_analytics` for each channel with `days: 7`.

3. **Pull recent posts** — Call `postiz_list_posts` with a date range covering the last 7 days to get actual post content alongside the analytics.

4. **Analyze performance** — For each platform, identify:
   - **Top 3 performers**: Posts with highest engagement (likes, comments, reposts, impressions)
   - **Bottom 3 performers**: Posts with lowest engagement
   - **Patterns**: What do top posts have in common? (topic, format, time of day, hook style, length)
   - **Anti-patterns**: What do bottom posts share? (topic, format, style)

5. **Extract actionable insights** — Synthesize into concrete recommendations:
   - Which topics resonate most on each platform?
   - Which post formats (thread vs single, story vs how-to) drive engagement?
   - What hook styles work best?
   - Optimal posting times (if data supports it)
   - Any content that performed differently across platforms

6. **Store to knowledge base** — Call `knowledge_store` with:
   - `title`: `"Engagement Insights — Week of [date]"`
   - `content`: Full analysis including metrics, top/bottom posts, patterns, and recommendations
   - `tags`: `["engagement-insights", "top-performing-content", "week-YYYY-WW"]`

7. **Report to user** — Present a summary:

## Output Format

```
**Engagement Report — Week of [Date]**

**LinkedIn Performance**
- Total impressions: [N]
- Total engagements: [N]
- Top post: "[excerpt]" — [metrics]
- Trend: [up/down/stable] vs last week

**X Performance**
- Total impressions: [N]
- Total engagements: [N]
- Top post: "[excerpt]" — [metrics]
- Trend: [up/down/stable] vs last week

**Key Insights**
1. [Insight about what's working]
2. [Insight about what to change]
3. [Insight about audience preferences]

**Recommendations for Next Week**
- [Specific recommendation 1]
- [Specific recommendation 2]
- [Specific recommendation 3]
```

## Guidelines

- Focus on actionable insights, not vanity metrics.
- Compare this week to previous weeks when past data is available in the knowledge base.
- Be honest about what's not working — the goal is to improve, not to celebrate.
- If analytics data is limited or unavailable for a platform, note it and work with what's available.
- Keep the report concise — this feeds into the content engine, so clarity matters more than length.
