import { Type } from "@sinclair/typebox";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

// ── Imagen helpers ─────────────────────────────────────────────────────
const IMAGEN_BASE = "https://generativelanguage.googleapis.com/v1beta";
const IMAGEN_MODEL = "imagen-4.0-generate-001";

async function imagenGenerate(
  apiKey: string,
  prompt: string,
  aspectRatio: string,
) {
  const res = await fetch(
    `${IMAGEN_BASE}/models/${IMAGEN_MODEL}:predict`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
        },
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Imagen error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── DALL-E helpers ─────────────────────────────────────────────────────
const DALLE_URL = "https://api.openai.com/v1/images/generations";

function aspectRatioToSize(ar: string): string {
  if (ar === "9:16") return "1024x1792";
  if (ar === "16:9") return "1792x1024";
  return "1024x1024";
}

async function dalleGenerate(
  apiKey: string,
  prompt: string,
  aspectRatio: string,
) {
  const res = await fetch(DALLE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: aspectRatioToSize(aspectRatio),
      quality: "standard",
      response_format: "url",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DALL-E error ${res.status}: ${text}`);
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

async function uploadToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  data: ArrayBuffer,
): Promise<{ id: string; webViewLink: string }> {
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const boundary = "media_upload_boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n`;

  const encoder = new TextEncoder();
  const prefix = encoder.encode(body);
  const base64Data = Buffer.from(data).toString("base64");
  const suffix = encoder.encode(`\r\n--${boundary}--`);
  const fullBody = Buffer.concat([
    prefix,
    encoder.encode(base64Data),
    suffix,
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload error ${res.status}: ${text}`);
  }
  const file = await res.json();

  // Make shareable (anyone with link)
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
async function persistMedia(opts: {
  convexUrl?: string;
  driveFolderId?: string;
  driveClientId?: string;
  driveClientSecret?: string;
  driveRefreshToken?: string;
  base64Data?: string;
  sourceUrl?: string;
  mimeType: string;
  prompt: string;
  provider: string;
}): Promise<{ convexUrl?: string; driveUrl?: string }> {
  const result: { convexUrl?: string; driveUrl?: string } = {};

  // Store to Convex
  if (opts.convexUrl) {
    try {
      let actionName: string;
      let body: Record<string, string>;

      if (opts.base64Data) {
        actionName = "mediaActions:storeImage";
        body = {
          base64Data: opts.base64Data,
          mimeType: opts.mimeType,
          prompt: opts.prompt,
          provider: opts.provider,
        };
      } else if (opts.sourceUrl) {
        actionName = "mediaActions:storeImageFromUrl";
        body = {
          sourceUrl: opts.sourceUrl,
          mimeType: opts.mimeType,
          prompt: opts.prompt,
          provider: opts.provider,
        };
      } else {
        throw new Error("No image data to store");
      }

      const convexRes = await fetch(
        `${opts.convexUrl}/api/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: actionName, args: body }),
        },
      );
      if (convexRes.ok) {
        const data = await convexRes.json();
        result.convexUrl = data.value?.url;
      } else {
        const text = await convexRes.text();
        console.error(`Convex action failed ${convexRes.status}: ${text}`);
      }
    } catch (err) {
      console.error("Convex storage failed:", err);
    }
  }

  // Upload to Google Drive (OAuth2 refresh token)
  if (opts.driveFolderId && opts.driveClientId && opts.driveClientSecret && opts.driveRefreshToken) {
    try {
      let imageBuffer: ArrayBuffer;
      if (opts.base64Data) {
        imageBuffer = Buffer.from(opts.base64Data, "base64").buffer;
      } else if (opts.sourceUrl) {
        const res = await fetch(opts.sourceUrl);
        imageBuffer = await res.arrayBuffer();
      } else {
        throw new Error("No image data for Drive upload");
      }

      const accessToken = await getDriveAccessToken(
        opts.driveClientId,
        opts.driveClientSecret,
        opts.driveRefreshToken,
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const ext = opts.mimeType.includes("png") ? "png" : "jpg";
      const fileName = `image-${opts.provider}-${timestamp}.${ext}`;

      const driveFile = await uploadToDrive(
        accessToken,
        opts.driveFolderId,
        fileName,
        opts.mimeType,
        imageBuffer,
      );
      result.driveUrl = driveFile.webViewLink;
    } catch (err) {
      console.error("Drive upload failed:", err);
    }
  }

  return result;
}

// ── Plugin ─────────────────────────────────────────────────────────────
const imageGenPlugin = {
  id: "image-gen",
  name: "Image Generation",
  description:
    "Generate images using Google Imagen 4 (default) or OpenAI DALL-E 3.",
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
      pluginApi.logger?.warn?.("geminiApiKey not configured for image-gen");
      return;
    }

    pluginApi.registerTool({
      name: "image_generate",
      label: "Generate Image",
      description:
        "Generate an image from a text prompt. Uses Google Imagen 4 by default (fast & high quality). " +
        "Optionally specify provider='dalle' for OpenAI DALL-E 3. " +
        "Images are automatically persisted to Convex (permanent URL) and Google Drive (shareable link) if configured.",
      parameters: Type.Object({
        prompt: Type.String({
          description: "Text description of the image to generate",
        }),
        provider: Type.Optional(
          Type.String({
            description:
              'Image provider: "imagen" (default, Google Imagen 4) or "dalle" (OpenAI DALL-E 3)',
          }),
        ),
        aspectRatio: Type.Optional(
          Type.String({
            description:
              'Aspect ratio: "1:1" (default, square), "16:9" (landscape), or "9:16" (portrait)',
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        const provider = (params.provider || "imagen").toLowerCase();
        const aspectRatio = params.aspectRatio || "1:1";

        try {
          if (provider === "dalle") {
            if (!openaiApiKey) {
              return json({
                error:
                  "OpenAI API key not configured. Cannot use DALL-E provider.",
              });
            }

            const data = await dalleGenerate(
              openaiApiKey,
              params.prompt,
              aspectRatio,
            );
            const image = data.data?.[0];

            // Persist media
            const stored = await persistMedia({
              convexUrl,
              driveFolderId,
              driveClientId,
              driveClientSecret,
              driveRefreshToken,
              sourceUrl: image?.url,
              mimeType: "image/png",
              prompt: params.prompt,
              provider: "dalle",
            });

            return json({
              provider: "dalle",
              status: "completed",
              imageUrl: stored.convexUrl || image?.url,
              temporaryUrl: image?.url,
              convexUrl: stored.convexUrl,
              driveUrl: stored.driveUrl,
              revisedPrompt: image?.revised_prompt,
              message: stored.convexUrl
                ? "Image generated and stored permanently."
                : "Image generated. URL expires in ~1 hour.",
            });
          }

          // Default: Imagen
          const data = await imagenGenerate(
            geminiApiKey,
            params.prompt,
            aspectRatio,
          );
          const prediction = data.predictions?.[0];
          if (!prediction?.bytesBase64Encoded) {
            return json({
              provider: "imagen",
              status: "failed",
              error: "No image data in response",
              raw: data,
            });
          }

          // Persist media
          const stored = await persistMedia({
            convexUrl,
            driveFolderId,
            driveClientId,
            driveClientSecret,
            driveRefreshToken,
            base64Data: prediction.bytesBase64Encoded,
            mimeType: prediction.mimeType || "image/jpeg",
            prompt: params.prompt,
            provider: "imagen",
          });

          return json({
            provider: "imagen",
            status: "completed",
            mimeType: prediction.mimeType || "image/jpeg",
            imageBase64: stored.convexUrl
              ? undefined
              : prediction.bytesBase64Encoded,
            imageUrl: stored.convexUrl,
            convexUrl: stored.convexUrl,
            driveUrl: stored.driveUrl,
            message: stored.convexUrl
              ? "Image generated and stored permanently. Use imageUrl for the permanent link."
              : "Image generated. The imageBase64 field contains the base64-encoded image data.",
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── media_gallery ───────────────────────────────────────────────
    if (convexUrl) {
      pluginApi.registerTool({
        name: "media_gallery",
        label: "Media Gallery",
        description:
          "List recently generated images and videos with their permanent URLs and Drive links. " +
          "Optionally filter by type (image/video).",
        parameters: Type.Object({
          type: Type.Optional(
            Type.String({
              description:
                'Filter by media type: "image" or "video". Omit for all.',
            }),
          ),
          limit: Type.Optional(
            Type.Number({
              description: "Max number of results (default: 10)",
            }),
          ),
        }),
        async execute(_toolCallId: string, params: any) {
          try {
            const queryArgs: Record<string, unknown> = {};
            if (params.type) queryArgs.type = params.type;
            if (params.limit) queryArgs.limit = params.limit;

            const res = await fetch(
              `${convexUrl}/api/query`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: "media:list", args: queryArgs }),
              },
            );
            if (!res.ok) {
              const text = await res.text();
              throw new Error(`Convex query error ${res.status}: ${text}`);
            }
            const data = await res.json();
            const items = data.value || [];
            return json({
              count: items.length,
              media: items.map((item: any) => ({
                id: item._id,
                type: item.type,
                prompt: item.prompt,
                provider: item.provider,
                url: item.url,
                driveUrl: item.driveUrl,
                createdAt: new Date(item.createdAt).toISOString(),
              })),
            });
          } catch (err) {
            return json({
              error: err instanceof Error ? err.message : String(err),
            });
          }
        },
      });
    }
  },
};

export default imageGenPlugin;
