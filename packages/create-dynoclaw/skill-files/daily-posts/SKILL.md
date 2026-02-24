---
name: daily-posts
description: Draft daily LinkedIn and X posts from the content calendar
user-invocable: true
metadata: {"openclaw":{"emoji":"✍️"}}
---

# Daily Posts

Draft LinkedIn and/or X posts for today based on the content calendar. Present drafts for approval before creating them as Postiz drafts.

## Modes

### Mode 1: Calendar-driven (default, no arguments)

1. **Get today's assignment** — Call `knowledge_search` with query `"content calendar"` and tags `["content-calendar"]`. Find today's entry (match by day of week and date).

2. If no calendar exists or today has no assignment, tell the user and suggest running `/content-engine` first.

### Mode 2: Ad-hoc (user provides a topic)

If invoked as `/daily-posts [topic]`, skip the calendar lookup and use the provided topic. Determine appropriate platforms (default: both LinkedIn and X).

## Steps

3. **Draft the content** based on today's platform assignment:

   **For LinkedIn:**
   - Length: 300-700 words
   - Style: Narrative, first-person, conversational
   - Structure: Hook (1-2 lines) → Story/insight (2-3 paragraphs) → Takeaway → CTA question
   - Use line breaks between paragraphs (LinkedIn formatting)
   - No hashtags in the body — add 3-5 relevant hashtags at the very end

   **For X (single post):**
   - Length: Under 280 characters
   - Style: Punchy, opinionated, direct
   - Include a hook that stops the scroll

   **For X (thread):**
   - 4-7 tweets, each under 280 characters
   - Tweet 1: Bold claim or question (the hook)
   - Tweets 2-5: Supporting points, examples, data
   - Last tweet: Takeaway + CTA (follow, repost, reply)
   - Number each tweet: 1/, 2/, etc.

4. **Present drafts** — Show each draft clearly labeled with the platform. Ask the user to:
   - `approve both` — approve LinkedIn and X drafts
   - `approve linkedin` — approve only LinkedIn
   - `approve x` — approve only X
   - `edit [platform] [feedback]` — regenerate with the given feedback

5. **On approval** — For each approved platform:
   - Call `postiz_channels` to get the integration IDs
   - Call `postiz_create_post` with:
     - `integrationIds`: the channel ID for that platform
     - `content`: the approved draft text
     - `platformTypes`: `"linkedin"` or `"x"`
     - `type`: `"draft"`
   - Confirm to the user that the draft was created in Postiz

6. **On edit request** — Regenerate the specified platform's draft incorporating the feedback, then present again for approval.

## Guidelines

- Write as if you are the user — first person, authentic voice.
- LinkedIn posts should tell a story or share a genuine insight, not read like AI content.
- X posts should be sharp and opinionated. Avoid corporate-speak.
- Never include placeholder text like "[Your Name]" or "[Company]".
- Each draft should be ready to post as-is after approval.
- If the calendar specifies key points and a hook, use them as starting points but don't be constrained by them.
