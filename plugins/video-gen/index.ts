import { Type } from "@sinclair/typebox";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 180_000; // 3 minutes

// ── Veo helpers ────────────────────────────────────────────────────────
const VEO_BASE = "https://generativelanguage.googleapis.com/v1beta";
const VEO_MODEL = "veo-3.1-fast-generate-preview";

async function veoGenerate(
  apiKey: string,
  prompt: string,
  duration: number,
  aspectRatio: string,
) {
  const res = await fetch(
    `${VEO_BASE}/models/${VEO_MODEL}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          aspectRatio,
          durationSeconds: duration,
          sampleCount: 1,
        },
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Veo submit error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.name as string;
}

async function veoPoll(apiKey: string, operationName: string) {
  const res = await fetch(`${VEO_BASE}/${operationName}`, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Veo poll error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Sora helpers ───────────────────────────────────────────────────────
const SORA_BASE = "https://api.openai.com/v1/videos";

function aspectRatioToSize(ar: string): string {
  return ar === "9:16" ? "720x1280" : "1280x720";
}

async function soraGenerate(
  apiKey: string,
  prompt: string,
  duration: number,
  aspectRatio: string,
) {
  const seconds = duration <= 4 ? 4 : duration <= 8 ? 8 : 12;

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("model", "sora-2");
  formData.append("size", aspectRatioToSize(aspectRatio));
  formData.append("seconds", String(seconds));

  const res = await fetch(SORA_BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sora submit error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.id as string;
}

async function soraPoll(apiKey: string, videoId: string) {
  const res = await fetch(`${SORA_BASE}/${videoId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sora poll error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Google Drive helpers (OAuth2 refresh token) ───────────────────────
async function getDriveAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Drive token error ${tokenRes.status}: ${text}`);
  }
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function uploadToDriveResumable(
  accessToken: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  data: ArrayBuffer,
): Promise<{ id: string; webViewLink: string }> {
  const initRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(data.byteLength),
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
      }),
    },
  );
  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`Drive resumable init error ${initRes.status}: ${text}`);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("No upload URL in resumable init response");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(data.byteLength),
    },
    body: data,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Drive upload error ${uploadRes.status}: ${text}`);
  }
  const file = await uploadRes.json();

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );

  return { id: file.id, webViewLink: file.webViewLink };
}

// ── Media persistence helper ──────────────────────────────────────────
async function persistVideo(opts: {
  convexUrl?: string;
  driveFolderId?: string;
  driveClientId?: string;
  driveClientSecret?: string;
  driveRefreshToken?: string;
  sourceUrl: string;
  mimeType: string;
  prompt: string;
  provider: string;
  authHeader?: string;
  apiKeyHeader?: string;
}): Promise<{ convexUrl?: string; driveUrl?: string }> {
  const result: { convexUrl?: string; driveUrl?: string } = {};

  // Store to Convex
  if (opts.convexUrl) {
    try {
      const body: Record<string, string> = {
        sourceUrl: opts.sourceUrl,
        mimeType: opts.mimeType,
        prompt: opts.prompt,
        provider: opts.provider,
      };
      if (opts.authHeader) body.authHeader = opts.authHeader;
      if (opts.apiKeyHeader) body.apiKeyHeader = opts.apiKeyHeader;

      const convexRes = await fetch(
        `${opts.convexUrl}/api/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "mediaActions:storeVideo", args: body }),
        },
      );
      if (convexRes.ok) {
        const data = await convexRes.json();
        result.convexUrl = data.value?.url;
      } else {
        const text = await convexRes.text();
        console.error(`Convex video action failed ${convexRes.status}: ${text}`);
      }
    } catch (err) {
      console.error("Convex video storage failed:", err);
    }
  }

  // Upload to Google Drive (resumable, OAuth2 refresh token)
  if (opts.driveFolderId && opts.driveClientId && opts.driveClientSecret && opts.driveRefreshToken) {
    try {
      const headers: Record<string, string> = {};
      if (opts.authHeader) headers["Authorization"] = opts.authHeader;
      if (opts.apiKeyHeader) headers["x-goog-api-key"] = opts.apiKeyHeader;

      const res = await fetch(opts.sourceUrl, { headers });
      if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
      const videoBuffer = await res.arrayBuffer();

      const accessToken = await getDriveAccessToken(
        opts.driveClientId,
        opts.driveClientSecret,
        opts.driveRefreshToken,
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `video-${opts.provider}-${timestamp}.mp4`;

      const driveFile = await uploadToDriveResumable(
        accessToken,
        opts.driveFolderId,
        fileName,
        opts.mimeType,
        videoBuffer,
      );
      result.driveUrl = driveFile.webViewLink;
    } catch (err) {
      console.error("Drive video upload failed:", err);
    }
  }

  return result;
}

// ── Plugin ─────────────────────────────────────────────────────────────
const videoGenPlugin = {
  id: "video-gen",
  name: "Video Generation",
  description:
    "Generate videos using Google Veo (default) or OpenAI Sora. Submits async jobs and polls for completion.",
  configSchema: {
    type: "object" as const,
    properties: {
      geminiApiKey: { type: "string" as const },
      openaiApiKey: { type: "string" as const },
      convexUrl: { type: "string" as const },
      driveFolderId: { type: "string" as const },
      driveClientId: { type: "string" as const },
      driveClientSecret: { type: "string" as const },
      driveRefreshToken: { type: "string" as const },
    },
    required: ["geminiApiKey"],
  },
  register(pluginApi: any) {
    const geminiApiKey = pluginApi.pluginConfig?.geminiApiKey;
    const openaiApiKey = pluginApi.pluginConfig?.openaiApiKey;
    const convexUrl = pluginApi.pluginConfig?.convexUrl;
    const driveFolderId = pluginApi.pluginConfig?.driveFolderId;
    const driveClientId = pluginApi.pluginConfig?.driveClientId;
    const driveClientSecret = pluginApi.pluginConfig?.driveClientSecret;
    const driveRefreshToken = pluginApi.pluginConfig?.driveRefreshToken;

    if (!geminiApiKey) {
      pluginApi.logger?.warn?.("geminiApiKey not configured for video-gen");
      return;
    }

    // ── video_generate ────────────────────────────────────────────────
    pluginApi.registerTool({
      name: "video_generate",
      label: "Generate Video",
      description:
        "Generate a video from a text prompt. Uses Google Veo by default (fast & cheap). " +
        "Optionally specify provider='sora' for OpenAI Sora. Polls until complete or timeout (3 min), " +
        "then returns the video URL or a job ID for later status checks. " +
        "Videos are automatically persisted to Convex (permanent URL) and Google Drive (shareable link) if configured.",
      parameters: Type.Object({
        prompt: Type.String({
          description: "Text description of the video to generate",
        }),
        provider: Type.Optional(
          Type.String({
            description:
              'Video provider: "veo" (default, Google Veo 3.1 Fast) or "sora" (OpenAI Sora 2)',
          }),
        ),
        duration: Type.Optional(
          Type.Number({
            description:
              "Video duration in seconds (default: 6). Veo supports 4/6/8, Sora supports 4/8/12.",
          }),
        ),
        aspectRatio: Type.Optional(
          Type.String({
            description:
              'Aspect ratio: "16:9" (default, landscape) or "9:16" (portrait)',
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        const provider = (params.provider || "veo").toLowerCase();
        const duration = params.duration || 6;
        const aspectRatio = params.aspectRatio || "16:9";

        try {
          if (provider === "sora") {
            if (!openaiApiKey) {
              return json({
                error:
                  "OpenAI API key not configured. Cannot use Sora provider.",
              });
            }

            const videoId = await soraGenerate(
              openaiApiKey,
              params.prompt,
              duration,
              aspectRatio,
            );

            const deadline = Date.now() + POLL_TIMEOUT_MS;
            while (Date.now() < deadline) {
              await sleep(POLL_INTERVAL_MS);
              const status = await soraPoll(openaiApiKey, videoId);

              if (status.status === "completed") {
                const downloadUrl = `${SORA_BASE}/${videoId}/content`;

                const stored = await persistVideo({
                  convexUrl,
                  driveFolderId,
                  driveClientId,
                  driveClientSecret,
                  driveRefreshToken,
                  sourceUrl: downloadUrl,
                  mimeType: "video/mp4",
                  prompt: params.prompt,
                  provider: "sora",
                  authHeader: `Bearer ${openaiApiKey}`,
                });

                return json({
                  provider: "sora",
                  status: "completed",
                  videoId,
                  videoUrl: stored.convexUrl || downloadUrl,
                  convexUrl: stored.convexUrl,
                  driveUrl: stored.driveUrl,
                  message: stored.convexUrl
                    ? "Video generated and stored permanently."
                    : "Video generated. Use the download URL to fetch the MP4 (requires auth header).",
                });
              }
              if (status.status === "failed") {
                return json({
                  provider: "sora",
                  status: "failed",
                  videoId,
                  error:
                    status.error ||
                    status.failure_reason ||
                    "Generation failed",
                });
              }
            }

            return json({
              provider: "sora",
              status: "timeout",
              videoId,
              message:
                "Video generation still in progress after 3 minutes. Use video_status to check later.",
            });
          }

          // Default: Veo
          const operationName = await veoGenerate(
            geminiApiKey,
            params.prompt,
            duration,
            aspectRatio,
          );

          const deadline = Date.now() + POLL_TIMEOUT_MS;
          while (Date.now() < deadline) {
            await sleep(POLL_INTERVAL_MS);
            const result = await veoPoll(geminiApiKey, operationName);

            if (result.done) {
              const samples =
                result.response?.generateVideoResponse?.generatedSamples;
              if (samples && samples.length > 0) {
                const videoUri = samples[0].video?.uri;

                const stored = await persistVideo({
                  convexUrl,
                  driveFolderId,
                  driveClientId,
                  driveClientSecret,
                  driveRefreshToken,
                  sourceUrl: videoUri,
                  mimeType: "video/mp4",
                  prompt: params.prompt,
                  provider: "veo",
                  apiKeyHeader: geminiApiKey,
                });

                return json({
                  provider: "veo",
                  status: "completed",
                  operationName,
                  videoUrl: stored.convexUrl || videoUri,
                  convexUrl: stored.convexUrl,
                  driveUrl: stored.driveUrl,
                  message: stored.convexUrl
                    ? "Video generated and stored permanently."
                    : "Video generated. The URL is accessible for 48 hours (requires x-goog-api-key header).",
                });
              }
              return json({
                provider: "veo",
                status: "completed",
                operationName,
                error: "No video samples in response",
                raw: result.response,
              });
            }

            if (result.error) {
              return json({
                provider: "veo",
                status: "failed",
                operationName,
                error: result.error,
              });
            }
          }

          return json({
            provider: "veo",
            status: "timeout",
            jobId: operationName,
            message:
              "Video generation still in progress after 3 minutes. Use video_status to check later.",
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── video_status ──────────────────────────────────────────────────
    pluginApi.registerTool({
      name: "video_status",
      label: "Video Status",
      description:
        "Check the status of a pending video generation job. Use this if video_generate timed out and returned a job ID.",
      parameters: Type.Object({
        jobId: Type.String({
          description:
            "The job/operation ID returned by video_generate (operation name for Veo, video ID for Sora)",
        }),
        provider: Type.String({
          description: 'The provider: "veo" or "sora"',
        }),
      }),
      async execute(_toolCallId: string, params: any) {
        const provider = (params.provider || "veo").toLowerCase();

        try {
          if (provider === "sora") {
            if (!openaiApiKey) {
              return json({ error: "OpenAI API key not configured." });
            }
            const status = await soraPoll(openaiApiKey, params.jobId);

            if (status.status === "completed") {
              const downloadUrl = `${SORA_BASE}/${params.jobId}/content`;

              const stored = await persistVideo({
                convexUrl,
                driveFolderId,
                driveClientId,
                driveClientSecret,
                driveRefreshToken,
                sourceUrl: downloadUrl,
                mimeType: "video/mp4",
                prompt: "Video (persisted on status check)",
                provider: "sora",
                authHeader: `Bearer ${openaiApiKey}`,
              });

              return json({
                provider: "sora",
                status: "completed",
                videoId: params.jobId,
                videoUrl: stored.convexUrl || downloadUrl,
                convexUrl: stored.convexUrl,
                driveUrl: stored.driveUrl,
                message: "Video is ready.",
              });
            }
            return json({
              provider: "sora",
              status: status.status,
              videoId: params.jobId,
              progress: status.progress,
            });
          }

          // Default: Veo
          const result = await veoPoll(geminiApiKey, params.jobId);

          if (result.done) {
            const samples =
              result.response?.generateVideoResponse?.generatedSamples;
            if (samples && samples.length > 0) {
              const videoUri = samples[0].video?.uri;

              const stored = await persistVideo({
                convexUrl,
                driveFolderId,
                driveClientId,
                driveClientSecret,
                driveRefreshToken,
                sourceUrl: videoUri,
                mimeType: "video/mp4",
                prompt: "Video (persisted on status check)",
                provider: "veo",
                apiKeyHeader: geminiApiKey,
              });

              return json({
                provider: "veo",
                status: "completed",
                operationName: params.jobId,
                videoUrl: stored.convexUrl || videoUri,
                convexUrl: stored.convexUrl,
                driveUrl: stored.driveUrl,
                message: "Video is ready.",
              });
            }
            return json({
              provider: "veo",
              status: "completed",
              operationName: params.jobId,
              error: "No video samples in response",
              raw: result.response,
            });
          }

          if (result.error) {
            return json({
              provider: "veo",
              status: "failed",
              operationName: params.jobId,
              error: result.error,
            });
          }

          return json({
            provider: "veo",
            status: "in_progress",
            operationName: params.jobId,
            message: "Still generating. Try again in a few seconds.",
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });
  },
};

export default videoGenPlugin;
