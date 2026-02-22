import { Type } from "@sinclair/typebox";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

const convexKnowledgePlugin = {
  id: "convex-knowledge",
  name: "Convex Knowledge Base",
  description: "Knowledge storage and semantic search via Convex",
  configSchema: {
    type: "object" as const,
    properties: {
      convexUrl: { type: "string" as const },
    },
    required: ["convexUrl"],
  },
  register(pluginApi: any) {
    const convexUrl = pluginApi.pluginConfig?.convexUrl;
    if (!convexUrl) {
      pluginApi.logger?.warn?.("convexUrl not configured");
      return;
    }

    // Uses Convex HTTP API directly to avoid the convex SDK dependency in plugins.
    // See: https://docs.convex.dev/http-api
    async function callConvexAction(name: string, args: Record<string, any>) {
      const url = `${convexUrl}/api/action`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: name, args }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Convex error ${response.status}: ${text}`);
      }
      const data = await response.json();
      return data.value;
    }

    // ── Store knowledge ───────────────────────────────────────────────
    pluginApi.registerTool({
      name: "knowledge_store",
      label: "Knowledge Store",
      description:
        "Store a piece of knowledge for later retrieval. Use this when the user says remember this or wants to save information.",
      parameters: Type.Object({
        text: Type.String({ description: "The knowledge text to store" }),
        tags: Type.Optional(
          Type.String({
            description: "Comma-separated tags for categorizing the knowledge",
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const tags = params.tags
            ? params.tags.split(",").map((t: string) => t.trim())
            : [];
          const id = await callConvexAction("knowledgeActions:ingest", {
            text: params.text,
            tags,
            source: "telegram",
          });
          return json({
            success: true,
            id,
            message: `Stored: "${params.text.slice(0, 80)}${params.text.length > 80 ? "..." : ""}"`,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    });

    // ── Search knowledge ──────────────────────────────────────────────
    pluginApi.registerTool({
      name: "knowledge_search",
      label: "Knowledge Search",
      description:
        "Search the knowledge base for relevant information. Use this when the user asks what do I know about or wants to recall stored knowledge.",
      parameters: Type.Object({
        query: Type.String({ description: "The search query" }),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const results = await callConvexAction("knowledgeActions:search", {
            query: params.query,
            limit: 5,
          });
          return json({
            results: (results || []).map((r: any) => ({
              text: r.text,
              tags: r.tags,
              score: r.score,
            })),
            count: (results || []).length,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    });
  },
};

export default convexKnowledgePlugin;
