import { Type } from "@sinclair/typebox";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

const postizPlugin = {
  id: "postiz",
  name: "Postiz Social Media",
  description: "Social media management via Postiz API",
  configSchema: {
    type: "object" as const,
    properties: {
      postizUrl: { type: "string" as const },
      postizApiKey: { type: "string" as const },
    },
    required: ["postizUrl", "postizApiKey"],
  },
  register(pluginApi: any) {
    const postizUrl = pluginApi.pluginConfig?.postizUrl;
    const postizApiKey = pluginApi.pluginConfig?.postizApiKey;

    if (!postizUrl || !postizApiKey) {
      pluginApi.logger?.warn?.("postizUrl or postizApiKey not configured");
      return;
    }

    const baseUrl = postizUrl.replace(/\/+$/, "") + "/api";

    async function callPostiz(method: string, path: string, body?: any) {
      const url = `${baseUrl}${path}`;
      const options: RequestInit = {
        method,
        headers: {
          Authorization: postizApiKey,
          "Content-Type": "application/json",
        },
      };
      if (body) {
        options.body = JSON.stringify(body);
      }
      const response = await fetch(url, options);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Postiz error ${response.status}: ${text}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    }

    // ── List connected social channels ──────────────────────────────
    pluginApi.registerTool({
      name: "postiz_channels",
      label: "Postiz Channels",
      description:
        "List all connected social media channels (X, LinkedIn, etc.) from Postiz. Call this first to get channel/integration IDs before creating posts.",
      parameters: Type.Object({}),
      async execute() {
        try {
          const data = await callPostiz("GET", "/public/v1/integrations");
          return json(data);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    });

    // ── Ensure image URL has a file extension (Postiz/Twitter requires it) ──
    // Convex storage URLs have no extension — rewrite to the HTTP proxy route
    // that serves the same blob at /storage/{id}.{ext}
    async function ensureImageExtension(url: string): Promise<string> {
      const parsed = new URL(url);
      if (/\.(png|jpg|jpeg|gif|webp|mp4)$/i.test(parsed.pathname)) return url;

      // Detect Convex storage URLs: .../api/storage/{id}
      const convexMatch = parsed.pathname.match(/\/api\/storage\/([a-f0-9-]+)$/);
      if (convexMatch) {
        // Determine extension from content-type
        let ext = "png";
        try {
          const res = await fetch(url, { method: "HEAD" });
          const ct = res.headers.get("content-type") || "";
          const extMap: Record<string, string> = {
            "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif",
            "image/webp": "webp", "video/mp4": "mp4",
          };
          ext = extMap[ct] || "png";
        } catch { /* default to png */ }

        // Rewrite to Convex HTTP proxy: https://{site}/storage/{id}.{ext}
        const siteUrl = parsed.origin.replace(".convex.cloud", ".convex.site");
        return `${siteUrl}/storage/${convexMatch[1]}.${ext}`;
      }

      // Non-Convex URL without extension — append query param as best-effort
      parsed.searchParams.set("filename", "image.png");
      return parsed.toString();
    }

    // ── Create a post (defaults to draft) ───────────────────────────
    pluginApi.registerTool({
      name: "postiz_create_post",
      label: "Postiz Create Post",
      description:
        'Create a social media post via Postiz. Defaults to draft mode. For multi-platform, pass comma-separated integrationIds and platformTypes. Call postiz_channels first to get IDs. ' +
        'For Instagram, postType defaults to "post" (can also be "story").',
      parameters: Type.Object({
        integrationIds: Type.String({
          description:
            "Comma-separated integration/channel IDs from postiz_channels (e.g. 'id1,id2' for multi-platform)",
        }),
        content: Type.String({ description: "The post text content" }),
        platformTypes: Type.String({
          description:
            'Comma-separated platform types matching each integrationId, e.g. "instagram,linkedin"',
        }),
        type: Type.Optional(
          Type.String({
            description:
              'Post type: "draft" (default), "schedule" (requires date), or "now". Per policy, defaults to draft.',
          }),
        ),
        postType: Type.Optional(
          Type.String({
            description:
              'Content format: "post" (default) or "story". Required for Instagram.',
          }),
        ),
        date: Type.Optional(
          Type.String({
            description:
              'ISO 8601 date for scheduled posts (required when type is "schedule")',
          }),
        ),
        imageUrls: Type.Optional(
          Type.String({
            description:
              'Comma-separated image URLs to attach. Each URL becomes an image attachment with auto-generated ID.',
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const scheduleType = params.type || "draft";
          const postType = params.postType || "post";
          const ids = params.integrationIds.split(",").map((s: string) => s.trim());
          const platforms = params.platformTypes.split(",").map((s: string) => s.trim());
          const rawUrls = params.imageUrls && params.imageUrls.trim() !== ""
            ? params.imageUrls.split(",").map((s: string) => s.trim())
            : [];
          const images = await Promise.all(
            rawUrls.map(async (url: string, idx: number) => ({
              id: `img-${Date.now()}-${idx}`,
              path: await ensureImageExtension(url),
            }))
          );

          // Build platform-specific settings
          function buildSettings(platform: string) {
            const settings: any = { __type: platform };
            if (platform === "instagram") {
              settings.post_type = postType;
              settings.is_trial_reel = false;
              settings.collaborators = [];
            } else if (platform === "x") {
              settings.who_can_reply_post = "everyone";
            }
            return settings;
          }

          const body: any = {
            type: scheduleType,
            shortLink: false,
            tags: [],
            posts: ids.map((id: string, i: number) => ({
              integration: { id },
              value: [{ content: params.content, image: images }],
              settings: buildSettings(platforms[i] || platforms[0]),
            })),
          };

          // Always include date
          if (params.date) {
            body.date = params.date;
          } else {
            body.date = new Date(Date.now() + 3600000).toISOString();
          }

          const data = await callPostiz("POST", "/public/v1/posts", body);
          return json({
            ...data,
            message: `Post created as ${scheduleType}${scheduleType === "schedule" ? ` for ${params.date}` : ""}`,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    });

    // ── List posts by date range ────────────────────────────────────
    pluginApi.registerTool({
      name: "postiz_list_posts",
      label: "Postiz List Posts",
      description:
        "List posts from Postiz within a date range. Useful for reviewing drafts or scheduled posts.",
      parameters: Type.Object({
        startDate: Type.String({
          description: "Start date in ISO 8601 format (e.g. 2026-02-18)",
        }),
        endDate: Type.String({
          description: "End date in ISO 8601 format (e.g. 2026-02-25)",
        }),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const data = await callPostiz(
            "GET",
            `/public/v1/posts?startDate=${encodeURIComponent(params.startDate)}&endDate=${encodeURIComponent(params.endDate)}`,
          );
          return json(data);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    });

    // ── Delete a post ───────────────────────────────────────────────
    pluginApi.registerTool({
      name: "postiz_delete_post",
      label: "Postiz Delete Post",
      description: "Delete a post from Postiz by its ID.",
      parameters: Type.Object({
        id: Type.String({ description: "The post ID to delete" }),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const data = await callPostiz(
            "DELETE",
            `/public/v1/posts/${encodeURIComponent(params.id)}`,
          );
          return json({ success: true, message: `Post ${params.id} deleted`, ...data });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    });

    // ── Channel analytics ──────────────────────────────────────────
    pluginApi.registerTool({
      name: "postiz_analytics",
      label: "Postiz Analytics",
      description:
        "Get analytics for a specific social media channel. Returns engagement metrics for the last N days.",
      parameters: Type.Object({
        integrationId: Type.String({
          description: "The integration/channel ID from postiz_channels",
        }),
        days: Type.Optional(
          Type.Number({ description: "Number of days to look back (default: 7)" }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const days = params.days || 7;
          const data = await callPostiz(
            "GET",
            `/public/v1/analytics/${encodeURIComponent(params.integrationId)}?date=${days}`,
          );
          return json(data);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) });
        }
      },
    });
  },
};

export default postizPlugin;
