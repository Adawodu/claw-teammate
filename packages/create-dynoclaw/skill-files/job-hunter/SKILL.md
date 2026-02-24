---
name: job-hunter
description: Find ideal roles, research companies, and draft outreach to get noticed by hiring teams
user-invocable: true
metadata: {"openclaw":{"emoji":"🎯"}}
---

# Job Hunter

Search for roles, research target companies, and draft personalized outreach messages. All outputs are **draft-only** — nothing is sent automatically.

## Candidate Profile

Use this profile to evaluate role fit and personalize all outputs:

- **Current:** Fractional CTO @ Metric Health (health tech SaaS, 35 clinics)
- **Previous:** Program Manager @ Chevron ($100M+ enterprise), Engineering Manager @ Accenture (Marriott 100M+ users), Founder @ Lafia.io (500K patient records, Africa health tech)
- **Builder:** myir.io (AI platform, 0→1), ShemShems (fintech, cross-border payments)
- **Education:** UC Berkeley Haas (Technology Strategy), SAFe 5 PO/PM, CSM
- **Domains:** Digital health, enterprise SaaS, AI/ML platforms, fintech, Africa tech
- **Strengths:** 0→1 product builds, HIPAA/SOC2 compliance, API architecture, scaling engineering teams
- **Target roles:** VP/Director Product, VP Engineering, Head of Product, Startup CTO/Co-founder

## Modes

This skill has 3 modes based on the argument passed:

### Mode 1: Find Roles (default — no arguments)

Run 5-6 `web_search` queries targeting job boards and company career pages:

1. `"VP Product" OR "Director of Product" hiring health tech 2026`
2. `"Head of Product" OR "CTO" startup AI digital health`
3. `"VP Engineering" OR "CTO" Series A Series B healthtech`
4. `"Product Leader" fintech Africa remote`
5. `"CTO" OR "co-founder" healthtech AI startup hiring`
6. `site:linkedin.com/jobs "VP Product" "digital health" OR "AI" remote`

**Filtering rules — skip roles that:**
- Require deep IC coding (e.g., "must write production code daily")
- Require a PhD as a hard requirement
- Are in industries with no overlap to the candidate's domains

**For each match (up to 5 roles), output:**

```
**🎯 Role Matches**

1. **[Role Title]** — [Company Name] ([Location / Remote])
   **Why it fits:** [1-2 sentences mapping candidate experience to the JD]
   **Fit:** [Strong / Good / Stretch]
   **Link:** [URL]

2. ...
```

### Mode 2: Company Research (`research <company>`)

When the argument starts with `research`, use `web_search` and `web_fetch` to gather intel on the specified company:

1. **What they do** — 1-2 sentence overview
2. **Recent news** — funding, launches, pivots from the last 90 days
3. **Leadership team** — CEO, CTO, VP Product (names + LinkedIn if findable)
4. **Tech stack signals** — from job postings, engineering blogs, GitHub
5. **Culture signals** — Glassdoor, team posts, values page
6. **Pain points Bayo could solve** — map company needs to his experience

**Output format:**

```
**🔍 Company Intel: [Company Name]**

**What they do:** [1-2 sentences]

**Recent news:**
- [Item 1]
- [Item 2]

**Leadership:**
- CEO: [Name] ([LinkedIn if found])
- CTO: [Name] ([LinkedIn if found])
- VP Product: [Name] ([LinkedIn if found])

**Tech stack signals:** [What you found]

**Culture signals:** [What you found]

**Where Bayo fits:** [2-3 sentences mapping company needs → candidate experience]
```

Keep the brief to ~300 words.

### Mode 3: Draft Outreach (`outreach <company> <role>`)

When the argument starts with `outreach`, draft personalized messages for the specified company and role. If company research hasn't been done yet, run Mode 2 internally first.

Draft these 3 messages:

**1. LinkedIn Connection Request** (300 character limit)
- Personalized hook referencing a shared interest or company's recent news
- Keep it peer-to-peer, not applicant-to-recruiter

**2. Short Email** (~150 words)
- Positioned as peer-to-peer outreach
- Reference a specific company challenge that Bayo's experience addresses
- End with a soft ask (conversation, not application)

**3. Warm Intro Request** (~100 words)
- Message Bayo can send to a mutual connection asking for an introduction
- Brief context on why this company/role is interesting

**Output format:**

```
**✉️ Outreach Drafts: [Role] @ [Company]**

**LinkedIn Connection Request** (≤300 chars):
> [Draft message]

**Email to Hiring Manager:**
Subject: [Subject line]

[Draft email body]

**Warm Intro Request:**
[Draft message to mutual connection]
```

## Guidelines

- All messages are **drafts only** — never send anything automatically.
- Be specific — generic outreach gets ignored. Reference real company details.
- Avoid sounding desperate or overly formal. Tone should be confident and conversational.
- If `web_search` returns thin results for a company, say so rather than fabricating details.
- When scoring fit, be honest — mark roles as "Stretch" when there's a gap rather than overselling.
