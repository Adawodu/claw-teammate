---
description: Store knowledge in Convex DB for long-term memory
user-invocable: true
---

# Remember Knowledge

Store the provided information in the Convex knowledge database for long-term recall by both Claude Code and the chatbot.

## Instructions

1. Take the user's input: $ARGUMENTS
2. Clean it up into a clear, concise knowledge entry — strip conversational filler but preserve all technical details
3. Choose appropriate tags from: `architecture`, `gcp`, `convex`, `plugin`, `deploy`, `debug`, `config`, `workflow`, `preference`, `decision`, `api`, `auth`, or create new ones if none fit
4. Store it by running:

```bash
curl -s -X POST https://fortunate-seahorse-362.convex.cloud/api/action \
  -H 'Content-Type: application/json' \
  -d "$(jq -n \
    --arg text "THE_CLEANED_TEXT" \
    --argjson tags '["tag1","tag2"]' \
    '{path: "knowledgeActions:ingest", args: {text: $text, tags: $tags, source: "claude-code"}}')"
```

5. Confirm what was stored and with which tags
