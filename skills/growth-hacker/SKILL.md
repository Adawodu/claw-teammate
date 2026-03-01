---
name: growth-hacker
description: Multi-product growth strategy, experiments, and competitive analysis
user-invocable: true
metadata: {"openclaw":{"emoji":"📈"}}
---

# Growth Hacker

On-demand growth strategy across Bayo's product portfolio (ParallelScore, ShemShems, myir.io, withLoam, DynoClaw, personal brand). All outputs are **draft-only** — nothing is published automatically.

## Step 1: Ask Before Acting

**CRITICAL: Do NOT auto-run anything.** When this skill is invoked, FIRST ask Bayo what he wants. Present these options:

> **📈 Growth Hacker — What would you like to do?**
>
> 1. **Audit** — Analyze current growth metrics across products and channels
> 2. **Experiment** — Propose a growth experiment (A/B test, new channel, partnership)
> 3. **Cross-promote** — Draft content that cross-pollinates audience across products
> 4. **Competitor scan** — Research competitors for a specific product
> 5. **Funnel analysis** — Identify drop-off points and suggest optimizations
> 6. **Log metrics** — Record current growth metrics for a product
>
> You can also specify:
> - A product to focus on (e.g. "audit ShemShems")
> - A channel (e.g. "experiment for LinkedIn")
> - A metric (e.g. "funnel for newsletter signups")

**Wait for Bayo's response before taking any action.** If he gives a direct instruction (e.g. "scan competitors for withLoam"), skip the menu and act on it.

## Mode 1: Audit

Analyze growth health across the portfolio or a specific product.

1. **Pull engagement data** — Call `knowledge_search` with query `"engagement insights metrics performance"` and tags `["engagement-insights"]`.
2. **Pull content calendar** — Call `knowledge_search` with query `"content calendar"` and tags `["content-calendar"]`.
3. **Pull product updates** — Call `knowledge_search` with query `"PRODUCT UPDATE"`. Note recent milestones that may affect growth strategy.
4. **Web research** — Run `web_search` for the target product(s):
   - `"[product name] site traffic analytics"`
   - `"[product name] reviews mentions"`
5. **Synthesize** — Present findings in this format:

```
**📊 Growth Audit — [Product or "Portfolio"]**

**Channel Health:**
| Channel | Status | Trend | Top Content |
|---------|--------|-------|-------------|
| LinkedIn | 🟢/🟡/🔴 | ↑/↓/→ | [Best post] |
| X | ... | ... | ... |
| Newsletter | ... | ... | ... |

**Key Metrics:**
- [Metric]: [Value] ([trend])

**Opportunities:**
1. [Specific actionable opportunity]
2. [Specific actionable opportunity]

**Risks:**
1. [Thing that could hurt growth]
```

After the audit, ask: *"Want me to propose an experiment for any of these opportunities?"*

## Mode 2: Experiment

Propose a single, testable growth experiment.

1. **Understand context** — Pull recent engagement data and content performance via `knowledge_search`.
2. **Research** — Run 2-3 `web_search` queries for relevant benchmarks and case studies.
3. **Design experiment** — Present in this format:

```
**🧪 Growth Experiment Proposal**

**Hypothesis:** If we [action], then [expected outcome] because [reasoning].

**Product:** [Target product]
**Channel:** [Where this runs]
**Duration:** [Timeline]

**Method:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Success Metric:** [Primary KPI] — target [X]% improvement
**Guardrail Metric:** [What we don't want to hurt]

**Effort:** [Low / Medium / High]
**Expected Impact:** [Low / Medium / High]

**Tracking:**
- UTM: `utm_source=X&utm_medium=Y&utm_campaign=Z`
- Measurement: [How to measure results]
```

After proposing, ask: *"Want me to draft the content/assets for this experiment?"*

When Bayo reports back with experiment results, store them:
- Call `knowledge_store` with:
  - `text`: `"GROWTH EXPERIMENT RESULT [product] [today's date]: Hypothesis: [what was tested]. Result: [outcome]. Learnings: [key takeaways]."`
  - `tags`: `["growth-experiment", "[product-lowercase]"]`

## Mode 3: Cross-Promote

Draft content that naturally connects audiences across products.

1. **Identify pairing** — Pick 2 products that share a natural connection (e.g. personal brand + DynoClaw, ShemShems + withLoam for family audience).
2. **Research angles** — Run `web_search` for trending topics that bridge both products.
3. **Draft content** — Create platform-specific drafts:

```
**🔗 Cross-Promotion Draft**

**Products:** [Product A] ↔ [Product B]
**Angle:** [The natural connection point]

**LinkedIn Post:**
[Draft — 150-200 words, story format]

**X Thread (3-5 tweets):**
1/ [Hook]
2/ [Product A context]
3/ [Bridge to Product B]
4/ [Insight/lesson]
5/ [CTA]

**Newsletter Mention (50 words):**
[Quick hit for the newsletter]
```

After drafting, ask: *"Want me to adjust tone, add a different product pairing, or schedule this into the content calendar?"*

## Mode 4: Competitor Scan

Research competitors for a specific product.

1. **Ask which product** (if not specified).
2. **Research** — Run 5 `web_search` queries:
   - `"[product category] competitors 2026"`
   - `"[competitor 1] vs [competitor 2] reviews"`
   - `"[product category] market size growth"`
   - `"[competitor name] pricing features"`
   - `"[product category] trends predictions"`
3. **Present findings:**

```
**🔍 Competitor Scan — [Product]**

**Direct Competitors:**
| Competitor | Strengths | Weaknesses | Pricing |
|-----------|-----------|------------|---------|
| [Name] | [What they do well] | [Gaps] | [Range] |

**Indirect Competitors:**
- [Name] — [How they overlap]

**Market Trends:**
- [Trend 1 with data]
- [Trend 2 with data]

**Differentiation Opportunities:**
1. [Where Bayo's product can win]
2. [Underserved niche]

**Positioning Recommendation:**
[1-2 sentences on how to position against competitors]
```

After presenting the scan, store the findings:
- Call `knowledge_store` with:
  - `text`: `"COMPETITOR INTEL [product] [today's date]: [Top 2-3 competitors with key strengths/weaknesses]. Market trends: [1-2 key trends]. Differentiation opportunities: [top 2 opportunities]."`
  - `tags`: `["competitor-intel", "[product-lowercase]"]`

Then ask: *"Want me to draft positioning content or propose an experiment based on these findings?"*

## Mode 5: Funnel Analysis

Identify drop-off points and suggest optimizations.

1. **Identify funnel** — Ask which product/funnel (if not specified): signup, onboarding, activation, retention, referral, or newsletter.
2. **Pull data** — Call `knowledge_search` for any existing funnel data or analytics.
3. **Research benchmarks** — Run `web_search` for industry benchmarks:
   - `"[product category] conversion rate benchmarks 2026"`
   - `"[funnel stage] optimization best practices SaaS"`
4. **Present analysis:**

```
**🔻 Funnel Analysis — [Product] [Funnel Type]**

**Current Funnel:**
[Stage 1] → [Stage 2] → [Stage 3] → [Stage 4]
  100%    →   X%     →    Y%    →    Z%

**Biggest Drop-off:** [Stage] — losing [X]% of users here

**Benchmark Comparison:**
| Stage | Current | Industry Avg | Gap |
|-------|---------|-------------|-----|
| ... | ... | ... | ... |

**Quick Wins (< 1 week):**
1. [Low-effort improvement]
2. [Low-effort improvement]

**Strategic Fixes (1-4 weeks):**
1. [Higher-effort improvement]

**Recommended Experiment:**
[One specific test to run on the biggest drop-off]
```

After the analysis, ask: *"Want me to design an experiment for the biggest drop-off point?"*

## Mode 6: Log Metrics

Record current growth metrics for a product to track progress over time.

1. **Ask for details** — If not provided:
   - Which product?
   - What metrics? (e.g. users, MRR, signups, page views, conversion rate, social followers)
2. **Store to knowledge DB** — Call `knowledge_store` with:
   - `text`: `"GROWTH METRICS [product] [today's date]: [metric1]: [value], [metric2]: [value], ... Source: [where the numbers came from]. Notes: [any context]."`
   - `tags`: `["growth-metrics", "[product-lowercase]"]`
3. **Confirm** — Tell Bayo the metrics were logged and will be used by content-engine and future audits.

## Guidelines

- **Always ask first, then act.** Don't run searches without direction.
- All content and recommendations are **drafts only** — never publish or send anything automatically.
- Be specific — generic advice like "improve your SEO" is useless. Give concrete, actionable steps.
- Every recommendation should include how to measure success.
- When data is unavailable, say so and suggest how to set up tracking.
- After completing any mode, suggest a natural next step.
- Reference the product portfolio knowledge from SOUL.md for context.
