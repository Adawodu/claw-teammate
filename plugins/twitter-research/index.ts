import { Type } from "@sinclair/typebox";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

const twitterResearchPlugin = {
  id: "twitter-research",
  name: "Twitter/X Research",
  description:
    "Research trends, search tweets, and look up users on Twitter/X. Read-only — no posting.",
  configSchema: {
    type: "object" as const,
    properties: {
      bearerToken: { type: "string" as const },
    },
    required: ["bearerToken"],
  },
  register(pluginApi: any) {
    const bearerToken = pluginApi.pluginConfig?.bearerToken;

    if (!bearerToken) {
      pluginApi.logger?.warn?.("Twitter bearerToken not configured");
      return;
    }

    const BASE = "https://api.twitter.com/2";

    async function callTwitter(path: string, params?: Record<string, string>) {
      const url = new URL(`${BASE}${path}`);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v) url.searchParams.set(k, v);
        }
      }
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Twitter API ${res.status}: ${text}`);
      }
      return res.json();
    }

    // ── Search recent tweets ────────────────────────────────────────
    pluginApi.registerTool({
      name: "twitter_search",
      label: "Twitter Search",
      description:
        "Search recent tweets (last 7 days) on Twitter/X. Supports Twitter search operators like from:, to:, #hashtag, -filter:retweets, lang:, etc.",
      parameters: Type.Object({
        query: Type.String({
          description:
            'Search query using Twitter operators. Examples: "AI agents", "#buildinpublic -filter:retweets", "from:elonmusk lang:en"',
        }),
        maxResults: Type.Optional(
          Type.Number({
            description: "Number of results (10-100, default 10)",
          })
        ),
        sortOrder: Type.Optional(
          Type.String({
            description: '"recency" (default) or "relevancy"',
          })
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const data = await callTwitter("/tweets/search/recent", {
            query: params.query,
            max_results: String(params.maxResults || 10),
            sort_order: params.sortOrder || "recency",
            "tweet.fields":
              "author_id,created_at,public_metrics,entities,lang",
            expansions: "author_id",
            "user.fields": "name,username,verified,public_metrics",
          });
          return json(data);
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Get trending topics ──────────────────────────────────────────
    pluginApi.registerTool({
      name: "twitter_trends",
      label: "Twitter Trends",
      description:
        "Get trending topics for a location on Twitter/X. Use WOEID 1 for worldwide, 23424977 for US, 23424975 for UK.",
      parameters: Type.Object({
        woeid: Type.Optional(
          Type.Number({
            description:
              "Where On Earth ID. 1=Worldwide, 23424977=US, 23424975=UK, 23424848=India. Default: 1",
          })
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const woeid = params.woeid || 1;
          // v1.1 endpoint — still works with Bearer token
          const res = await fetch(
            `https://api.twitter.com/1.1/trends/place.json?id=${woeid}`,
            { headers: { Authorization: `Bearer ${bearerToken}` } }
          );
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Twitter API ${res.status}: ${text}`);
          }
          const data = await res.json();
          // Flatten to just the trends array
          const trends = data[0]?.trends || [];
          return json({
            location: data[0]?.locations?.[0]?.name || "Unknown",
            as_of: data[0]?.as_of,
            trends: trends.slice(0, 30).map((t: any) => ({
              name: t.name,
              url: t.url,
              tweet_volume: t.tweet_volume,
            })),
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Look up a user ───────────────────────────────────────────────
    pluginApi.registerTool({
      name: "twitter_user",
      label: "Twitter User Lookup",
      description:
        "Look up a Twitter/X user by username. Returns profile info, follower count, and recent metrics.",
      parameters: Type.Object({
        username: Type.String({
          description: "Twitter username without @ (e.g. elonmusk)",
        }),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const data = await callTwitter(
            `/users/by/username/${encodeURIComponent(params.username)}`,
            {
              "user.fields":
                "created_at,description,location,public_metrics,verified,profile_image_url,url",
            }
          );
          return json(data);
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Get a user's recent tweets ───────────────────────────────────
    pluginApi.registerTool({
      name: "twitter_user_tweets",
      label: "Twitter User Tweets",
      description:
        "Get recent tweets from a specific Twitter/X user. Useful for competitive research or monitoring influencers.",
      parameters: Type.Object({
        username: Type.String({
          description: "Twitter username without @ (e.g. elonmusk)",
        }),
        maxResults: Type.Optional(
          Type.Number({
            description: "Number of tweets (5-100, default 10)",
          })
        ),
        excludeReplies: Type.Optional(
          Type.Boolean({
            description: "Exclude replies (default true)",
          })
        ),
        excludeRetweets: Type.Optional(
          Type.Boolean({
            description: "Exclude retweets (default true)",
          })
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          // First get user ID
          const userRes = await callTwitter(
            `/users/by/username/${encodeURIComponent(params.username)}`
          );
          const userId = userRes.data?.id;
          if (!userId) {
            return json({ error: `User @${params.username} not found` });
          }

          const excludes: string[] = [];
          if (params.excludeReplies !== false) excludes.push("replies");
          if (params.excludeRetweets !== false) excludes.push("retweets");

          const queryParams: Record<string, string> = {
            max_results: String(params.maxResults || 10),
            "tweet.fields":
              "created_at,public_metrics,entities,lang",
          };
          if (excludes.length > 0) {
            queryParams.exclude = excludes.join(",");
          }

          const data = await callTwitter(
            `/users/${userId}/tweets`,
            queryParams
          );
          return json(data);
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Count tweets matching a query ────────────────────────────────
    pluginApi.registerTool({
      name: "twitter_count",
      label: "Twitter Tweet Count",
      description:
        "Count how many tweets match a search query over time. Useful for measuring topic popularity and trend analysis.",
      parameters: Type.Object({
        query: Type.String({
          description: "Search query (same syntax as twitter_search)",
        }),
        granularity: Type.Optional(
          Type.String({
            description: '"day" (default), "hour", or "minute"',
          })
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const data = await callTwitter("/tweets/counts/recent", {
            query: params.query,
            granularity: params.granularity || "day",
          });
          return json(data);
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });
  },
};

export default twitterResearchPlugin;
