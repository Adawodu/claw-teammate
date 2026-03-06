---
name: daily-briefing
description: Curated daily briefing covering tech, healthcare, Africa, and fintech news
user-invocable: true
allowed-tools: Bash(uv run *generate_image*), Bash(GEMINI_API_KEY=*), Bash(*mediaActions*), Bash(*base64*), Bash(*curl*convex*)
metadata: {"openclaw":{"emoji":"📰"}}
---

# Daily Briefing

Produce a concise morning news briefing covering four topics. Use `web_search` to find stories from the last 24 hours, then summarize the top results.

## Steps

1. Run these four `web_search` queries (all filtered to the last 24 hours):
   - `"technology news today OR Hacker News"` — general tech, AI, startups, major product launches
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

5. **Store condensed briefing** — After presenting the output, call `knowledge_store` with:
   - `text`: `"DAILY BRIEFING [today's date]: [150-word condensed extract covering the top story from each section and any cross-topic highlights]"`
   - `tags`: `["briefing", "market-signal"]`

   The condensed extract should capture the single most significant story per section (Tech, Healthcare, Africa, Fintech) in 1-2 sentences each, plus any Worth Watching item.

6. **Generate comic visual** — After presenting the briefing, build a newspaper-grid comic prompt from the headlines and run:

   ```bash
   GEMINI_API_KEY="AIzaSyAkC1hPuNFGl8IeZRvnHL3xVoyitTvKmak" uv run /usr/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py --prompt "Vintage American comic book illustration. Ben-Day halftone dot shading throughout all areas. Torn aged paper edges with cream beige background tint. Bold black hand-lettered headers in ALL CAPS. Speech bubbles and caption boxes with solid black outlines. Warm color palette with golden yellows, burnt oranges, deep blues, and strong black ink outlines. Thick black panel borders separating all sections. Newspaper comic-page aesthetic like a page torn from a vintage comic book. No photorealism. No 3D rendering. No anime. A Black man with short natural hair and a warm confident smile wearing a tan brown casual overshirt with open collar. He is the speaker and presenter throughout the illustration drawn in stylized vintage comic art. Newspaper front page layout with multiple labeled sections and mini comic illustrations in each section. Thick black borders separate all sections like a comic page grid. Large bold banner headline across the top reads DAILY BRIEFING [today's date] with torn paper edges. The character appears in at least two sections as the presenter. Top-left section labeled TECH contains [top tech headline]. Top-right section labeled HEALTHCARE AND HEALTH IT contains [top health headline]. Bottom-left section labeled AFRICA BUSINESS AND TECH contains [top africa headline]. Bottom-center section labeled FINTECH AND INVESTMENT contains [top fintech headline]. Bottom-right box labeled SUMMARY AND ACTION contains text reading Subscribe or leave a comment to join my network for daily briefs." --filename "/tmp/comic-brief-$(date +%Y%m%d-%H%M%S).png" --resolution 1K
   ```

   Replace the `[top ... headline]` placeholders with the actual top story headline from each section.

7. **Persist comic to Convex** — After the image is generated, upload it to the media database for permanent storage:

   ```bash
   B64=$(base64 -w0 "FILEPATH") && curl -s -X POST "https://fortunate-seahorse-362.convex.cloud/api/action" -H "Content-Type: application/json" -d @- <<JSONEOF
   {"path":"mediaActions:storeImage","args":{"base64Data":"${B64}","mimeType":"image/png","prompt":"Daily Briefing comic [today's date]","provider":"comic-brief"}}
   JSONEOF
   ```

   Replace FILEPATH with the actual `/tmp/comic-brief-*.png` path from step 6. The response JSON contains a permanent URL at `.value.url`. Output `MEDIA: <permanent URL>` to send the image in chat.

## Guidelines

- Keep the total briefing to ~400-500 words — scannable, not exhaustive.
- Use bold for headlines and italic for source names.
- Do not editorialize. Stick to facts from the search results.
- If a search returns fewer than 3 quality stories, include only what is genuinely newsworthy rather than padding with low-quality results.
