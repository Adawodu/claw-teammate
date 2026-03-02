import { Type } from "@sinclair/typebox";
import { renderSlide as renderProfessional } from "./templates/professional";
import { renderSlide as renderBold } from "./templates/bold";
import { renderSlide as renderMinimal } from "./templates/minimal";
import type { Brand } from "./templates/professional";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

// ── Template defaults ───────────────────────────────────────────────
const TEMPLATE_DEFAULTS: Record<string, { primary: string; accent: string }> = {
  professional: { primary: "#F5D547", accent: "#1A7A6D" },
  bold: { primary: "#1E3A8A", accent: "#F97316" },
  minimal: { primary: "#1E293B", accent: "#FACC15" },
};

const TEMPLATE_RENDERERS: Record<string, typeof renderProfessional> = {
  professional: renderProfessional,
  bold: renderBold,
  minimal: renderMinimal,
};

// ── Google Drive helpers (copied from image-gen for persistence) ─────
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

// ── Media persistence helper ────────────────────────────────────────
async function persistMedia(opts: {
  convexUrl?: string;
  driveFolderId?: string;
  driveClientId?: string;
  driveClientSecret?: string;
  driveRefreshToken?: string;
  base64Data: string;
  mimeType: string;
  prompt: string;
  provider: string;
}): Promise<{ convexUrl?: string; driveUrl?: string }> {
  const result: { convexUrl?: string; driveUrl?: string } = {};

  // Store to Convex
  if (opts.convexUrl) {
    try {
      const convexRes = await fetch(
        `${opts.convexUrl}/api/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "mediaActions:storeImage",
            args: {
              base64Data: opts.base64Data,
              mimeType: opts.mimeType,
              prompt: opts.prompt,
              provider: opts.provider,
            },
          }),
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

  // Upload to Google Drive
  if (opts.driveFolderId && opts.driveClientId && opts.driveClientSecret && opts.driveRefreshToken) {
    try {
      const imageBuffer = Buffer.from(opts.base64Data, "base64").buffer;
      const accessToken = await getDriveAccessToken(
        opts.driveClientId,
        opts.driveClientSecret,
        opts.driveRefreshToken,
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `carousel-${timestamp}.png`;

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

// ── Plugin ──────────────────────────────────────────────────────────
const carouselGenPlugin = {
  id: "carousel-gen",
  name: "Carousel Generator",
  description:
    "Generate social media carousel images (1080x1080 PNGs) from structured content. " +
    "Supports three template styles: professional, bold, and minimal. " +
    "Configurable branding per call (name, colors, handle). " +
    "Images are persisted to Convex and Google Drive if configured.",
  configSchema: {
    type: "object" as const,
    properties: {
      convexUrl: { type: "string" as const },
      driveFolderId: { type: "string" as const },
      driveClientId: { type: "string" as const },
      driveClientSecret: { type: "string" as const },
      driveRefreshToken: { type: "string" as const },
    },
  },
  register(pluginApi: any) {
    const convexUrl = pluginApi.pluginConfig?.convexUrl;
    const driveFolderId = pluginApi.pluginConfig?.driveFolderId;
    const driveClientId = pluginApi.pluginConfig?.driveClientId;
    const driveClientSecret = pluginApi.pluginConfig?.driveClientSecret;
    const driveRefreshToken = pluginApi.pluginConfig?.driveRefreshToken;

    pluginApi.registerTool({
      name: "generate_carousel",
      label: "Generate Carousel",
      description:
        "Generate social media carousel images (1080x1080 PNGs) from structured content. " +
        "Provide a headline, array of slides with subtitle+body, and optional CTA. " +
        "Choose from three templates: professional (yellow/teal), bold (blue/orange), or minimal (navy/yellow). " +
        "Override brand colors, name, handle, and URL per call. " +
        "Returns an array of base64-encoded PNG images, one per slide.",
      parameters: Type.Object({
        headline: Type.String({
          description: "Cover slide headline text",
        }),
        slides: Type.Array(
          Type.Object({
            subtitle: Type.String({ description: "Slide subtitle/heading" }),
            body: Type.String({ description: "Slide body text" }),
          }),
          { description: "Content slides (each with subtitle and body)" },
        ),
        cta: Type.Optional(
          Type.String({
            description: 'Final slide CTA text (default: "Thank You")',
          }),
        ),
        template: Type.Optional(
          Type.String({
            description:
              'Template style: "professional" (default), "bold", or "minimal"',
          }),
        ),
        brandName: Type.Optional(
          Type.String({ description: "Brand name displayed on slides" }),
        ),
        brandHandle: Type.Optional(
          Type.String({ description: 'Social handle e.g. "@dynoclaw"' }),
        ),
        brandUrl: Type.Optional(
          Type.String({ description: "Website URL shown in footer" }),
        ),
        primaryColor: Type.Optional(
          Type.String({ description: "Primary brand color hex (default per template)" }),
        ),
        accentColor: Type.Optional(
          Type.String({ description: "Accent/secondary color hex (default per template)" }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const templateName = (params.template || "professional").toLowerCase();
          const renderer = TEMPLATE_RENDERERS[templateName];
          if (!renderer) {
            return json({
              error: `Unknown template "${templateName}". Use "professional", "bold", or "minimal".`,
            });
          }

          const defaults = TEMPLATE_DEFAULTS[templateName];
          const brand: Brand = {
            name: params.brandName || "Brand",
            handle: params.brandHandle || "",
            url: params.brandUrl || "",
            primaryColor: params.primaryColor || defaults.primary,
            accentColor: params.accentColor || defaults.accent,
          };

          // Build slide list: cover + content slides + CTA
          const allSlides: Array<{
            headline?: string;
            subtitle?: string;
            body?: string;
            cta?: string;
          }> = [];

          // Cover slide
          allSlides.push({ headline: params.headline });

          // Content slides
          for (const s of params.slides) {
            allSlides.push({ subtitle: s.subtitle, body: s.body });
          }

          // CTA slide
          allSlides.push({ cta: params.cta || "Thank You" });

          const total = allSlides.length;

          // Generate HTML for each slide
          const htmlSlides = allSlides.map((slide, i) =>
            renderer(slide, i, total, brand),
          );

          // Launch Puppeteer and screenshot each slide
          const puppeteer = require("puppeteer");
          const browser = await puppeteer.launch({
            headless: true,
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
            ],
          });

          const results: Array<{
            slideIndex: number;
            imageBase64: string;
            convexUrl?: string;
            driveUrl?: string;
          }> = [];

          try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1080, height: 1080 });

            for (let i = 0; i < htmlSlides.length; i++) {
              await page.setContent(htmlSlides[i], {
                waitUntil: "networkidle0",
              });
              const screenshot = await page.screenshot({
                type: "png",
                encoding: "base64",
              });

              const slideResult: (typeof results)[number] = {
                slideIndex: i,
                imageBase64: screenshot as string,
              };

              // Persist to Convex/Drive if configured
              const stored = await persistMedia({
                convexUrl,
                driveFolderId,
                driveClientId,
                driveClientSecret,
                driveRefreshToken,
                base64Data: screenshot as string,
                mimeType: "image/png",
                prompt: `Carousel slide ${i + 1}/${total}: ${params.headline}`,
                provider: "carousel-gen",
              });

              if (stored.convexUrl) slideResult.convexUrl = stored.convexUrl;
              if (stored.driveUrl) slideResult.driveUrl = stored.driveUrl;

              results.push(slideResult);
            }
          } finally {
            await browser.close();
          }

          return json({
            status: "completed",
            template: templateName,
            slideCount: results.length,
            slides: results.map((r) => ({
              slideIndex: r.slideIndex,
              imageBase64: r.convexUrl ? undefined : r.imageBase64,
              imageUrl: r.convexUrl,
              convexUrl: r.convexUrl,
              driveUrl: r.driveUrl,
            })),
            message: results[0]?.convexUrl
              ? `Generated ${results.length} carousel slides. Images stored permanently.`
              : `Generated ${results.length} carousel slides. Images returned as base64.`,
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

export default carouselGenPlugin;
