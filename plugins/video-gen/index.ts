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
  return data.name as string; // operation name
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
  // Sora accepts 4, 8, or 12 seconds — clamp to nearest
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
  return data.id as string; // video job id
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
    },
    required: ["geminiApiKey"],
  },
  register(pluginApi: any) {
    const geminiApiKey = pluginApi.pluginConfig?.geminiApiKey;
    const openaiApiKey = pluginApi.pluginConfig?.openaiApiKey;

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
        "then returns the video URL or a job ID for later status checks.",
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
            description: "Video duration in seconds (default: 6). Veo supports 4/6/8, Sora supports 4/8/12.",
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

            // Poll for completion
            const deadline = Date.now() + POLL_TIMEOUT_MS;
            while (Date.now() < deadline) {
              await sleep(POLL_INTERVAL_MS);
              const status = await soraPoll(openaiApiKey, videoId);

              if (status.status === "completed") {
                const downloadUrl = `${SORA_BASE}/${videoId}/content`;
                return json({
                  provider: "sora",
                  status: "completed",
                  videoId,
                  downloadUrl,
                  message:
                    "Video generated successfully. Use the download URL to fetch the MP4 (requires auth header).",
                });
              }
              if (status.status === "failed") {
                return json({
                  provider: "sora",
                  status: "failed",
                  videoId,
                  error: status.error || status.failure_reason || "Generation failed",
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

          // Poll for completion
          const deadline = Date.now() + POLL_TIMEOUT_MS;
          while (Date.now() < deadline) {
            await sleep(POLL_INTERVAL_MS);
            const result = await veoPoll(geminiApiKey, operationName);

            if (result.done) {
              const samples =
                result.response?.generateVideoResponse?.generatedSamples;
              if (samples && samples.length > 0) {
                const videoUri = samples[0].video?.uri;
                return json({
                  provider: "veo",
                  status: "completed",
                  operationName,
                  videoUrl: videoUri,
                  message:
                    "Video generated successfully. The URL is accessible for 48 hours (requires x-goog-api-key header to download).",
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
              return json({
                provider: "sora",
                status: "completed",
                videoId: params.jobId,
                downloadUrl: `${SORA_BASE}/${params.jobId}/content`,
                message: "Video is ready for download.",
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
              return json({
                provider: "veo",
                status: "completed",
                operationName: params.jobId,
                videoUrl: samples[0].video?.uri,
                message: "Video is ready. URL valid for 48 hours.",
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
