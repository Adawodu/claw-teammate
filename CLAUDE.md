# DynoClaw Project Notes

## Memory MCP Server

A persistent memory system for Claude Code/Kimi CLI has been set up using ConvexDB.

### Quick Commands

```bash
# Deploy schema changes
convex dev

# Setup MCP server (after schema is deployed)
bash setup-memory-mcp.sh
```

### Configuration

MCP server is configured in `~/.claude.json`. Update `OPENAI_API_KEY` to activate.

### Available Memory Tools

Once configured, you can use:

- `memory_store` - Save memories with semantic embeddings
- `memory_recall` - Semantic search
- `memory_search` - Keyword search  
- `memory_get_context` - Get recent context
- `memory_start_session` / `memory_end_session` - Session tracking

### Schema Changes

Added to `convex/schema.ts`:
- `agentMemory` - Stores memories with 1536-dim embeddings
- `agentSessions` - Tracks conversation sessions

See `convex/agentMemory.ts` for all query/mutation functions.

### Files

- `convex/schema.ts` - Updated with memory tables
- `convex/agentMemory.ts` - All Convex functions
- `setup-memory-mcp.sh` - One-command setup script
- `README-MEMORY-MCP.md` - Full documentation
