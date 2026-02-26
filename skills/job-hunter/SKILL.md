---
name: job-hunter
description: Find ideal roles, research companies, and draft outreach — asks for your direction first
user-invocable: true
metadata: {"openclaw":{"emoji":"🎯"}}
---

# Job Hunter

Search for roles, research target companies, and draft personalized outreach messages. All outputs are **draft-only** — nothing is sent automatically.

## Step 1: Ask Before Acting

**CRITICAL: Do NOT auto-run searches.** When this skill is invoked, FIRST ask Bayo what he wants. Present these options:

> **🎯 Job Hunter — What would you like to do?**
>
> 1. **Find roles** — I'll search the web for matching positions
> 2. **Crawl a specific site** — Give me a careers page URL and I'll scan it for listings
> 3. **Research a company** — Deep dive on a specific company
> 4. **Draft outreach** — Write connection requests, emails, and intro asks for a role
> 5. **Read a resume/JD** — Send me a PDF link and I'll extract the text
>
> You can also give me filters like:
> - Target sites (e.g. "search TikTok careers")
> - Role types (e.g. "only VP-level or above")
> - Industries (e.g. "health tech and fintech only")
> - Location (e.g. "remote only" or "Bay Area")
> - Keywords to include or exclude

**Wait for Bayo's response before taking any action.** If he gives a direct instruction (e.g. "search TikTok for product roles"), skip the menu and act on it.

## Candidate Profile

Use this profile to evaluate role fit and personalize all outputs:

- **Name:** Bayo Adawodu
- **Current:** Fractional CTO @ Metric Health (health tech SaaS, 35 clinics)
- **Previous:** Program Manager @ Chevron ($100M+ enterprise), Engineering Manager @ Accenture (Marriott 100M+ users), Founder @ Lafia.io (500K patient records, Africa health tech)
- **Builder:** myir.io (AI platform, 0→1), ShemShems (fintech, cross-border payments), DynoClaw (AI agent infrastructure SaaS)
- **Education:** UC Berkeley Haas (Technology Strategy), SAFe 5 PO/PM, CSM
- **Domains:** Digital health, enterprise SaaS, AI/ML platforms, fintech, Africa tech
- **Strengths:** 0→1 product builds, HIPAA/SOC2 compliance, API architecture, scaling engineering teams, multi-tenant platform design
- **Target roles:** VP/Director Product, VP Engineering, Head of Product, Startup CTO/Co-founder

If Bayo sends a resume (PDF or text), use it to **supplement** this profile — add any details not already listed. Acknowledge what's new but don't repeat the full profile back.

## Mode 1: Find Roles

Use `web_search` queries based on Bayo's filters. If he gave specific filters, build queries around them. If no filters, use these defaults:

1. `"VP Product" OR "Director of Product" hiring health tech 2026`
2. `"Head of Product" OR "CTO" startup AI digital health`
3. `"VP Engineering" OR "CTO" Series A Series B healthtech`
4. `"Product Leader" fintech Africa remote`
5. `"CTO" OR "co-founder" healthtech AI startup hiring`

If he asks to search a **specific company**, use `site:` prefix (e.g. `site:careers.tiktok.com "product"`).

**Filtering rules — skip roles that:**
- Require deep IC coding (e.g., "must write production code daily")
- Require a PhD as a hard requirement
- Are in industries with no overlap to the candidate's domains
- Don't match any user-specified filters

**For each match (up to 5 roles), output:**

```
**🎯 Role Matches**

1. **[Role Title]** — [Company Name] ([Location / Remote])
   **Why it fits:** [1-2 sentences mapping candidate experience to the JD]
   **Fit:** [Strong / Good / Stretch]
   **Link:** [URL]
```

After showing results, ask: *"Want me to research any of these companies, draft outreach for a role, or search with different filters?"*

## Mode 2: Crawl a Careers Site

When Bayo provides a URL (e.g. "scan lifeatTikTok.com for roles"), use the `crawl_website` tool:

- Set `linkPattern` to filter for job/role links (e.g. `/position/|/job/|/career/`)
- Set `maxPages` to 15-20 for thorough coverage
- Set `maxDepth` to 2 to follow from listing pages to individual job posts
- Use `extractSelector` if the site has a consistent job content container

After crawling, filter the results against the candidate profile and any user-specified filters. Present matches in the same format as Mode 1.

If `crawl_website` returns thin results (e.g. JavaScript-heavy site that doesn't render), fall back to `web_search` with `site:` prefix and explain why.

## Mode 3: Company Research

Use `web_search` and `crawl_website` to gather intel on a specified company:

1. **What they do** — 1-2 sentence overview
2. **Recent news** — funding, launches, pivots from the last 90 days
3. **Leadership team** — CEO, CTO, VP Product (names + LinkedIn if findable)
4. **Tech stack signals** — from job postings, engineering blogs, GitHub
5. **Culture signals** — Glassdoor, team posts, values page
6. **Pain points Bayo could solve** — map company needs to his experience

```
**🔍 Company Intel: [Company Name]**

**What they do:** [1-2 sentences]
**Recent news:** [bullets]
**Leadership:** [CEO, CTO, VP Product with LinkedIn if found]
**Tech stack signals:** [what you found]
**Culture signals:** [what you found]
**Where Bayo fits:** [2-3 sentences]
```

Keep the brief to ~300 words. Ask: *"Want me to draft outreach for a specific role here?"*

## Mode 4: Draft Outreach

Draft personalized messages for a specified company and role. If company research hasn't been done yet, run Mode 3 internally first.

Draft these 3 messages:

**1. LinkedIn Connection Request** (300 character limit)
- Personalized hook referencing a shared interest or company's recent news
- Peer-to-peer, not applicant-to-recruiter

**2. Short Email** (~150 words)
- Peer-to-peer outreach
- Reference a specific company challenge that Bayo's experience addresses
- Soft ask (conversation, not application)

**3. Warm Intro Request** (~100 words)
- Message Bayo can send to a mutual connection for an introduction

```
**✉️ Outreach Drafts: [Role] @ [Company]**

**LinkedIn Connection Request** (≤300 chars):
> [Draft]

**Email to Hiring Manager:**
Subject: [Subject line]
[Body]

**Warm Intro Request:**
[Draft]
```

## Mode 5: Read a PDF

When Bayo sends a PDF (resume, job description, etc.), use the `read_pdf` tool to extract the text. Then:

- If it's a **resume**: supplement the candidate profile with any new details. Summarize what's new.
- If it's a **job description**: evaluate fit against the candidate profile and provide a fit assessment.
- If unclear, ask what he'd like you to do with it.

## Guidelines

- **Always ask first, then act.** Don't run searches without direction.
- All messages are **drafts only** — never send anything automatically.
- Be specific — generic outreach gets ignored. Reference real company details.
- Confident and conversational tone. Not desperate, not overly formal.
- If `web_search` or `crawl_website` returns thin results, say so rather than fabricating details.
- When scoring fit, be honest — mark roles as "Stretch" when there's a gap.
- After completing any mode, suggest a natural next step (research → outreach, search → deeper dive on a match, etc.).
