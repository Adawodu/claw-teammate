# Claude Memory MCP Server

Persistent memory for Claude Code / Kimi CLI backed by your existing ConvexDB.

## Quick Start

```bash
# From dynoclaw directory
bash setup-memory-mcp.sh
```

This will:
1. Create the MCP server in `plugins/memory-mcp/`
2. Install dependencies
3. Build the server

## Configuration

### 1. Set Environment Variables

Create `plugins/memory-mcp/.env`:

```bash
CONVEX_URL=https://reminiscent-meerkat-118.convex.cloud
OPENAI_API_KEY=sk-...
USER_ID=adawodudriver
```

### 2. Update ~/.claude.json

Add this to your `mcpServers`:

```json
{
  "mcpServers": {
    "convex-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/adawodudriver/dynoclaw/plugins/memory-mcp/dist/index.js"],
      "env": {
        "CONVEX_URL": "https://reminiscent-meerkat-118.convex.cloud",
        "OPENAI_API_KEY": "sk-...",
        "USER_ID": "adawodudriver"
      }
    }
  }
}
```

### 3. Deploy Convex Schema

```bash
convex dev
# or
convex deploy
```

## Available Tools

| Tool | Description |
|------|-------------|
| `memory_store` | Save a memory with semantic embedding |
| `memory_recall` | Find memories by semantic similarity |
| `memory_search` | Keyword search memories |
| `memory_get_context` | Get recent project/session context |
| `memory_start_session` | Begin tracking a session |
| `memory_end_session` | End and summarize a session |
| `memory_get_session` | Get session details |
| `memory_list_sessions` | List all sessions |

## Usage Examples

```
# Store a preference
/memory_store
content: User prefers TypeScript over JavaScript
type: preference
importance: 8

# Recall relevant memories
/memory_recall
query: What language does the user prefer?

# Get recent context for this project
/memory_get_context
projectPath: /Users/adawodudriver/dynoclaw
hoursBack: 48
```

## Architecture

```
Kimi CLI → MCP Client → Memory MCP Server → ConvexDB (dynoclaw)
                              ↓
                        OpenAI Embeddings
```

## Schema

Two new tables added to your Convex schema:

- **agentMemory**: Stores memories with 1536-dim embeddings
- **agentSessions**: Tracks conversation sessions
