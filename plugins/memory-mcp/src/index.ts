#!/usr/bin/env node
/**
 * Claude Memory MCP Server
 * 
 * Provides persistent memory storage backed by ConvexDB for Claude Code / Kimi CLI.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";

// ── Configuration ──────────────────────────────────────────────────

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Error: CONVEX_URL environment variable is required");
  process.exit(1);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

const USER_ID = process.env.USER_ID || process.env.USER || "unknown";

// ── OpenAI Client ─────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Helper: Generate Embeddings ────────────────────────────────────

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

// ── MCP Server Setup ───────────────────────────────────────────────

const server = new Server(
  {
    name: "claude-memory",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── Tool Definitions ───────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "memory_store",
        description: "Store a memory in ConvexDB with semantic embedding",
        inputSchema: {
          type: "object",
          properties: {
            content: { type: "string", description: "The memory content" },
            type: { 
              type: "string", 
              enum: ["fact", "preference", "code_pattern", "decision", "context"]
            },
            importance: { type: "number", minimum: 1, maximum: 10 },
            projectPath: { type: "string" },
            files: { type: "array", items: { type: "string" } }
          },
          required: ["content", "type"]
        }
      },
      {
        name: "memory_recall",
        description: "Recall relevant memories using semantic search",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            type: { type: "string", enum: ["fact", "preference", "code_pattern", "decision", "context"] },
            projectPath: { type: "string" },
            limit: { type: "number", default: 5 }
          },
          required: ["query"]
        }
      },
      {
        name: "memory_search",
        description: "Search memories by keyword",
        inputSchema: {
          type: "object",
          properties: {
            searchTerm: { type: "string" },
            limit: { type: "number", default: 10 }
          },
          required: ["searchTerm"]
        }
      },
      {
        name: "memory_get_context",
        description: "Get recent context for session/project",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: { type: "string" },
            hoursBack: { type: "number", default: 24 }
          }
        }
      },
      {
        name: "memory_start_session",
        description: "Mark start of a new session",
        inputSchema: {
          type: "object",
          properties: { sessionId: { type: "string" } },
          required: ["sessionId"]
        }
      },
      {
        name: "memory_end_session",
        description: "Mark end of a session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            summary: { type: "string" }
          },
          required: ["sessionId"]
        }
      },
      {
        name: "memory_get_session",
        description: "Get session details",
        inputSchema: {
          type: "object",
          properties: { sessionId: { type: "string" } },
          required: ["sessionId"]
        }
      },
      {
        name: "memory_list_sessions",
        description: "List recent sessions",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "number", default: 20 } }
        }
      }
    ]
  };
});

// ── Session State ──────────────────────────────────────────────────

const sessionState: { sessionId: string | null } = { sessionId: null };

// ── Tool Handlers ──────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const sessionId = (args.sessionId as string) || 
                    sessionState.sessionId || 
                    process.env.CLAUDE_SESSION_ID || 
                    `session_${Date.now()}`;

  try {
    switch (name) {
      case "memory_store": {
        const embedding = await getEmbedding(args.content as string);
        const response = await fetch(`${CONVEX_URL}/api/mutation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "agentMemory:store",
            args: {
              sessionId, userId: USER_ID, type: args.type, content: args.content,
              projectPath: args.projectPath, files: args.files,
              importance: args.importance ?? 5, embedding
            }
          })
        });
        if (!response.ok) throw new Error(`Convex mutation failed: ${response.statusText}`);
        return { content: [{ type: "text", text: "✅ Memory stored" }] };
      }

      case "memory_recall": {
        const queryEmbedding = await getEmbedding(args.query as string);
        const response = await fetch(`${CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "agentMemory:recall",
            args: {
              userId: USER_ID, query: args.query, queryEmbedding,
              type: args.type, projectPath: args.projectPath, limit: args.limit ?? 5
            }
          })
        });
        if (!response.ok) throw new Error(`Convex query failed: ${response.statusText}`);
        const memories = (await response.json()).value || [];
        if (memories.length === 0) return { content: [{ type: "text", text: "No relevant memories found." }] };
        const formatted = memories.map((m: any) => 
          `[${m.type}] ${m.content} (score: ${m.score.toFixed(3)})`
        ).join("\n\n");
        return { content: [{ type: "text", text: formatted }] };
      }

      case "memory_search": {
        const response = await fetch(`${CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "agentMemory:searchByContent",
            args: { userId: USER_ID, searchTerm: args.searchTerm, limit: args.limit ?? 10 }
          })
        });
        if (!response.ok) throw new Error(`Convex query failed: ${response.statusText}`);
        const memories = (await response.json()).value || [];
        if (memories.length === 0) return { content: [{ type: "text", text: "No memories found." }] };
        const formatted = memories.map((m: any) => `[${m.type}] ${m.content}`).join("\n\n");
        return { content: [{ type: "text", text: formatted }] };
      }

      case "memory_get_context": {
        const response = await fetch(`${CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "agentMemory:getRecentContext",
            args: { userId: USER_ID, projectPath: args.projectPath, hoursBack: args.hoursBack ?? 24 }
          })
        });
        if (!response.ok) throw new Error(`Convex query failed: ${response.statusText}`);
        const context = (await response.json()).value || [];
        if (context.length === 0) return { content: [{ type: "text", text: "No recent context found." }] };
        const formatted = context.map((c: any) => `[${c.type}] ${c.content}`).join("\n\n");
        return { content: [{ type: "text", text: formatted }] };
      }

      case "memory_start_session": {
        sessionState.sessionId = sessionId;
        const response = await fetch(`${CONVEX_URL}/api/mutation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "agentMemory:startSession", args: { sessionId, userId: USER_ID } })
        });
        if (!response.ok) throw new Error(`Convex mutation failed: ${response.statusText}`);
        return { content: [{ type: "text", text: `Session ${sessionId} started.` }] };
      }

      case "memory_end_session": {
        const response = await fetch(`${CONVEX_URL}/api/mutation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "agentMemory:endSession", args: { sessionId, summary: args.summary } })
        });
        if (!response.ok) throw new Error(`Convex mutation failed: ${response.statusText}`);
        sessionState.sessionId = null;
        return { content: [{ type: "text", text: `Session ${sessionId} ended.` }] };
      }

      case "memory_get_session": {
        const response = await fetch(`${CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "agentMemory:getSession", args: { sessionId } })
        });
        if (!response.ok) throw new Error(`Convex query failed: ${response.statusText}`);
        const session = (await response.json()).value;
        if (!session) return { content: [{ type: "text", text: `Session ${sessionId} not found.` }] };
        const formatted = `Session: ${session.sessionId}
Started: ${new Date(session.startedAt).toLocaleString()}
${session.endedAt ? `Ended: ${new Date(session.endedAt).toLocaleString()}` : "Status: Active"}
${session.summary || ""}`;
        return { content: [{ type: "text", text: formatted }] };
      }

      case "memory_list_sessions": {
        const response = await fetch(`${CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "agentMemory:listSessions", args: { userId: USER_ID, limit: args.limit ?? 20 } })
        });
        if (!response.ok) throw new Error(`Convex query failed: ${response.statusText}`);
        const sessions = (await response.json()).value || [];
        if (sessions.length === 0) return { content: [{ type: "text", text: "No sessions found." }] };
        const formatted = sessions.map((s: any) => 
          `${s.sessionId} | ${new Date(s.startedAt).toLocaleDateString()} | ${s.endedAt ? "Completed" : "Active"}`
        ).join("\n");
        return { content: [{ type: "text", text: formatted }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${errorMessage}` }], isError: true };
  }
});

// ── Start Server ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Memory MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
