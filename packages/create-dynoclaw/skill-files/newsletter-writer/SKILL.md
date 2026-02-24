---
name: newsletter-writer
description: Draft weekly newsletter for Beehiiv from the week's content and insights
user-invocable: true
metadata: {"openclaw":{"emoji":"📧"}}
---

# Newsletter Writer

Draft a weekly newsletter that synthesizes the week's content, engagement insights, and briefing highlights into a cohesive Beehiiv draft.

## Steps

1. **Gather source material** — Run these `knowledge_search` calls:
   - Query: `"content calendar"`, tags: `["content-calendar"]` — this week's planned content
   - Query: `"engagement insights"`, tags: `["engagement-insights"]` — what performed well
   - Query: `"daily briefing"`, tags: `["briefing"]` — recent briefing summaries (if stored)

2. **Check Postiz analytics** (if available):
   - Call `postiz_channels` to get integration IDs
   - Call `postiz_analytics` for LinkedIn and X channels with `days: 7`
   - Note top-performing posts by engagement

3. **Draft the newsletter** with this structure:

   ### Newsletter Structure
   - **Subject line**: Compelling, curiosity-driven, under 50 characters
   - **Opening hook** (2-3 sentences): Start with a bold observation, question, or timely insight that connects to the main read
   - **Main read** (400-600 words): Deep dive into the week's most interesting topic. Tell a story, share analysis, or make a non-obvious connection between trends
   - **Quick hits** (3-4 bullets): Brief takes on other notable stories from the week. Each is 1-2 sentences with context
   - **What I'm building** (2-3 sentences): Brief update on current projects, learnings, or experiments. Authentic, informal
   - **CTA**: End with a question, request for replies, or pointer to follow on LinkedIn/X

4. **Present to user** — Show the full newsletter draft and offer 3 subject line options:
   - Option 1: Direct/descriptive
   - Option 2: Curiosity-driven/question
   - Option 3: Bold claim/hot take

   Ask the user to:
   - `publish [1/2/3]` — create the Beehiiv draft with that subject line
   - `edit [feedback]` — regenerate with feedback

5. **On publish** — Call `beehiiv_create_draft` with:
   - `title`: the chosen subject line
   - `content`: the newsletter body formatted as HTML
   - `subtitle`: a preview text snippet (first sentence of the opening hook)
   - Confirm to the user that the draft was created in Beehiiv

6. **On edit** — Regenerate incorporating feedback, present again.

## HTML Formatting

When creating the Beehiiv draft, convert the newsletter to clean HTML:
- Use `<h2>` for section headers
- Use `<p>` for paragraphs
- Use `<ul><li>` for quick hits
- Use `<strong>` for emphasis
- Use `<a href>` for any links
- Keep formatting minimal — Beehiiv applies its own template styling

## Guidelines

- The newsletter should feel like a letter from a smart friend, not a corporate update.
- The main read should have a clear narrative arc — don't just list facts.
- Quick hits should add value beyond what was already posted on social media.
- "What I'm building" should be genuine and specific, not vague.
- Total length: 600-900 words (readable in 3-4 minutes).
- Write in first person, conversational tone.
