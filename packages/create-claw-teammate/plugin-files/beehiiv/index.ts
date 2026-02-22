import { Type } from "@sinclair/typebox";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

const beehiivPlugin = {
  id: "beehiiv",
  name: "Beehiiv Newsletter",
  description: "Newsletter management via Beehiiv API",
  configSchema: {
    type: "object" as const,
    properties: {
      beehiivApiKey: { type: "string" as const },
      beehiivPublicationId: { type: "string" as const },
    },
    required: ["beehiivApiKey", "beehiivPublicationId"],
  },
  register(pluginApi: any) {
    const apiKey = pluginApi.pluginConfig?.beehiivApiKey;
    const publicationId = pluginApi.pluginConfig?.beehiivPublicationId;

    if (!apiKey || !publicationId) {
      pluginApi.logger?.warn?.("beehiivApiKey or beehiivPublicationId not configured");
      return;
    }

    const baseUrl = `https://api.beehiiv.com/v2/publications/${publicationId}`;

    async function callBeehiiv(method: string, path: string, body?: any) {
      const url = `${baseUrl}${path}`;
      const options: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      };
      if (body) {
        options.body = JSON.stringify(body);
      }
      const response = await fetch(url, options);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Beehiiv error ${response.status}: ${text}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    }

    // ── Create a newsletter draft ─────────────────────────────────────
    pluginApi.registerTool({
      name: "beehiiv_create_draft",
      label: "Beehiiv Create Draft",
      description:
        "Create a newsletter draft in Beehiiv. Always creates as draft (cannot publish directly per policy).",
      parameters: Type.Object({
        title: Type.String({ description: "The newsletter subject line / title" }),
        content: Type.String({
          description: "The newsletter body content in HTML format",
        }),
        subtitle: Type.Optional(
          Type.String({ description: "Optional preview text / subtitle" }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const body: any = {
            title: params.title,
            content_html: params.content,
            status: "draft",
          };
          if (params.subtitle) {
            body.subtitle = params.subtitle;
          }
          const data = await callBeehiiv("POST", "/posts", body);
          return json({
            ...data,
            message: "Newsletter draft created in Beehiiv",
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    });

    // ── List posts ────────────────────────────────────────────────────
    pluginApi.registerTool({
      name: "beehiiv_list_posts",
      label: "Beehiiv List Posts",
      description:
        "List newsletter posts from Beehiiv. Can filter by status (draft, confirmed, archived).",
      parameters: Type.Object({
        status: Type.Optional(
          Type.String({
            description:
              'Filter by status: "draft", "confirmed", "archived". Omit for all.',
          }),
        ),
        limit: Type.Optional(
          Type.Number({ description: "Number of posts to return (default: 10)" }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const queryParams = new URLSearchParams();
          if (params.status) queryParams.set("status", params.status);
          queryParams.set("limit", String(params.limit || 10));
          const qs = queryParams.toString();
          const data = await callBeehiiv("GET", `/posts${qs ? `?${qs}` : ""}`);
          return json(data);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    });

    // ── Get a single post ─────────────────────────────────────────────
    pluginApi.registerTool({
      name: "beehiiv_get_post",
      label: "Beehiiv Get Post",
      description: "Get a single newsletter post by ID from Beehiiv.",
      parameters: Type.Object({
        postId: Type.String({ description: "The Beehiiv post ID" }),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const data = await callBeehiiv(
            "GET",
            `/posts/${encodeURIComponent(params.postId)}`,
          );
          return json(data);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    });
  },
};

export default beehiivPlugin;
