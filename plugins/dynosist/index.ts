import { Type } from "@sinclair/typebox";
import * as fs from "fs";
import * as path from "path";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

// ── Gmail OAuth2 helpers ──────────────────────────────────────────────

async function getGmailAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail token error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function gmailApi(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API error ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : { success: true };
}

// ── MIME helpers ──────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".json": "application/json",
  ".xml": "application/xml",
  ".html": "text/html",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function base64url(data: string): string {
  return Buffer.from(data, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildSimpleMessage(to: string, subject: string, body: string, cc?: string, bcc?: string): string {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
  ];
  if (cc) headers.splice(1, 0, `Cc: ${cc}`);
  if (bcc) headers.splice(1, 0, `Bcc: ${bcc}`);
  return headers.join("\r\n") + "\r\n\r\n" + body;
}

function buildMultipartMessage(
  to: string,
  subject: string,
  body: string,
  attachments: { filename: string; mimeType: string; content: Buffer }[],
  cc?: string,
  bcc?: string,
): string {
  const boundary = `----DynoSist_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];
  if (cc) headers.splice(1, 0, `Cc: ${cc}`);
  if (bcc) headers.splice(1, 0, `Bcc: ${bcc}`);

  const parts: string[] = [];

  // Text body part
  parts.push(
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=utf-8\r\n` +
    `\r\n` +
    body,
  );

  // Attachment parts
  for (const att of attachments) {
    const b64 = att.content.toString("base64");
    parts.push(
      `--${boundary}\r\n` +
      `Content-Type: ${att.mimeType}; name="${att.filename}"\r\n` +
      `Content-Disposition: attachment; filename="${att.filename}"\r\n` +
      `Content-Transfer-Encoding: base64\r\n` +
      `\r\n` +
      b64,
    );
  }

  return headers.join("\r\n") + "\r\n\r\n" + parts.join("\r\n") + `\r\n--${boundary}--`;
}

// ── Plugin ────────────────────────────────────────────────────────────

const dynosistPlugin = {
  id: "dynosist",
  name: "DynoSist Email Assistant",
  description: "Create Gmail drafts with optional file attachments, list drafts, and find local files",
  configSchema: {
    type: "object" as const,
    properties: {
      gmailClientId: { type: "string" as const },
      gmailClientSecret: { type: "string" as const },
      gmailRefreshToken: { type: "string" as const },
    },
    required: ["gmailClientId", "gmailClientSecret", "gmailRefreshToken"],
  },
  register(pluginApi: any) {
    const clientId = pluginApi.pluginConfig?.gmailClientId;
    const clientSecret = pluginApi.pluginConfig?.gmailClientSecret;
    const refreshToken = pluginApi.pluginConfig?.gmailRefreshToken;

    if (!clientId || !clientSecret || !refreshToken) {
      pluginApi.logger?.warn?.("Gmail OAuth credentials not configured");
      return;
    }

    // ── Tool 1: Create Draft ────────────────────────────────────────

    pluginApi.registerTool({
      name: "dynosist_create_draft",
      label: "Create Gmail Draft",
      description:
        "Create a Gmail draft email with optional file attachments. " +
        "Attachments are local file paths (e.g. from Telegram uploads in /tmp/).",
      parameters: Type.Object({
        to: Type.String({ description: "Recipient email address" }),
        subject: Type.String({ description: "Email subject line" }),
        body: Type.String({ description: "Email body (plain text)" }),
        cc: Type.Optional(Type.String({ description: "CC recipients (comma-separated)" })),
        bcc: Type.Optional(Type.String({ description: "BCC recipients (comma-separated)" })),
        attachments: Type.Optional(
          Type.Array(Type.String({ description: "Local file path" }), {
            description: "Array of local file paths to attach",
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        const { to, subject, body, cc, bcc, attachments } = params;

        const accessToken = await getGmailAccessToken(clientId, clientSecret, refreshToken);

        let rawMessage: string;

        if (attachments && attachments.length > 0) {
          const attachmentData = attachments.map((filePath: string) => {
            if (!fs.existsSync(filePath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            return {
              filename: path.basename(filePath),
              mimeType: getMimeType(filePath),
              content: fs.readFileSync(filePath),
            };
          });
          rawMessage = buildMultipartMessage(to, subject, body, attachmentData, cc, bcc);
        } else {
          rawMessage = buildSimpleMessage(to, subject, body, cc, bcc);
        }

        const encoded = base64url(rawMessage);

        const result = await gmailApi(accessToken, "drafts", {
          method: "POST",
          body: JSON.stringify({ message: { raw: encoded } }),
        });

        const draftId = result.id;
        const messageId = result.message?.id;

        return json({
          success: true,
          draftId,
          messageId,
          to,
          subject,
          attachmentCount: attachments?.length || 0,
          gmailLink: `https://mail.google.com/mail/u/0/#drafts/${messageId || ""}`,
        });
      },
    });

    // ── Tool 2: List Drafts ─────────────────────────────────────────

    pluginApi.registerTool({
      name: "dynosist_list_drafts",
      label: "List Gmail Drafts",
      description: "List recent Gmail drafts with subject and recipient info.",
      parameters: Type.Object({
        maxResults: Type.Optional(
          Type.Number({ description: "Maximum number of drafts to return (default 10)", default: 10 }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        const maxResults = params.maxResults || 10;
        const accessToken = await getGmailAccessToken(clientId, clientSecret, refreshToken);

        const listResult = await gmailApi(accessToken, `drafts?maxResults=${maxResults}`);
        const drafts = listResult.drafts || [];

        if (drafts.length === 0) {
          return json({ drafts: [], message: "No drafts found" });
        }

        const details = await Promise.all(
          drafts.map(async (d: any) => {
            const detail = await gmailApi(
              accessToken,
              `drafts/${d.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`,
            );
            const headers = detail.message?.payload?.headers || [];
            const getHeader = (name: string) =>
              headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
            return {
              draftId: d.id,
              messageId: detail.message?.id,
              subject: getHeader("Subject"),
              to: getHeader("To"),
              date: getHeader("Date"),
            };
          }),
        );

        return json({ drafts: details, count: details.length });
      },
    });

    // ── Tool 3: Find Files ──────────────────────────────────────────

    pluginApi.registerTool({
      name: "dynosist_find_files",
      label: "Find Local Files",
      description:
        "Find files on the local filesystem, useful for locating Telegram uploads in /tmp/. " +
        "Returns filename, size, modified date, and full path.",
      parameters: Type.Object({
        pattern: Type.Optional(
          Type.String({ description: "Filename pattern to filter by (substring match, case-insensitive)" }),
        ),
        directory: Type.Optional(
          Type.String({ description: "Directory to search (default /tmp/)", default: "/tmp/" }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        const dir = params.directory || "/tmp/";
        const pattern = params.pattern?.toLowerCase();

        if (!fs.existsSync(dir)) {
          throw new Error(`Directory not found: ${dir}`);
        }

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files = entries
          .filter((e) => e.isFile())
          .map((e) => {
            const fullPath = path.join(dir, e.name);
            const stat = fs.statSync(fullPath);
            return {
              filename: e.name,
              path: fullPath,
              size: stat.size,
              sizeHuman: stat.size < 1024
                ? `${stat.size} B`
                : stat.size < 1024 * 1024
                  ? `${(stat.size / 1024).toFixed(1)} KB`
                  : `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
              modified: stat.mtime.toISOString(),
            };
          })
          .filter((f) => !pattern || f.filename.toLowerCase().includes(pattern))
          .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

        return json({ files, count: files.length, directory: dir });
      },
    });
  },
};

export default dynosistPlugin;
