Draft-only for Gmail + Beehiiv + social
PR-only for GitHub (no merge)
No secrets in code
No destructive commands

## Knowledge DB (Convex)

After completing significant tasks (new features, bug fixes, architecture decisions, config changes), store a concise summary in the Convex knowledge DB using:

```bash
curl -s -X POST https://fortunate-seahorse-362.convex.cloud/api/action \
  -H 'Content-Type: application/json' \
  -d "$(jq -n \
    --arg text "CONCISE_SUMMARY" \
    --argjson tags '["relevant","tags"]' \
    '{path: "knowledgeActions:ingest", args: {text: $text, tags: $tags, source: "claude-code"}}')"
```

What to store: key decisions, patterns discovered, bug root causes, config that worked, integration gotchas.
What NOT to store: trivial changes, things already in CLAUDE.md, session-specific context.
Use source `"claude-code"` always. Pick tags from: `architecture`, `gcp`, `convex`, `plugin`, `deploy`, `debug`, `config`, `workflow`, `preference`, `decision`, `api`, `auth` — or create new ones if needed.

Manual commands: `/remember <text>` to store, `/recall <query>` to search.
