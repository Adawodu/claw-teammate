---
description: Search Convex knowledge DB by semantic similarity
user-invocable: true
---

# Recall Knowledge

Search the Convex knowledge database for relevant entries using semantic search.

## Instructions

1. Take the user's query: $ARGUMENTS
2. Search the knowledge base:

```bash
curl -s -X POST https://fortunate-seahorse-362.convex.cloud/api/action \
  -H 'Content-Type: application/json' \
  -d "$(jq -n \
    --arg query "THE_QUERY" \
    '{path: "knowledgeActions:search", args: {query: $query, limit: 5}}')"
```

3. Parse the JSON response and present results clearly:
   - Show the text content of each match
   - Show tags and source
   - Show the relevance score
   - If no results found, say so
