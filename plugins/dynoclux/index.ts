import { Type } from "@sinclair/typebox";

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

// ── Convex HTTP API helpers ───────────────────────────────────────────

async function convexQuery(
  convexUrl: string,
  path: string,
  args: Record<string, unknown> = {},
): Promise<any> {
  const res = await fetch(`${convexUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex query error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.value;
}

async function convexMutation(
  convexUrl: string,
  path: string,
  args: Record<string, unknown> = {},
): Promise<any> {
  const res = await fetch(`${convexUrl}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex mutation error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.value;
}

// ── Business day calculation ──────────────────────────────────────────

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function addCalendarDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}

// ── Sender categorization ─────────────────────────────────────────────

interface MessageMeta {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  listUnsubscribe?: string;
}

function extractHeader(headers: any[], name: string): string {
  const h = headers.find(
    (h: any) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return h?.value || "";
}

function extractDomain(email: string): string {
  const match = email.match(/@([^\s>]+)/);
  return match ? match[1].toLowerCase() : email.toLowerCase();
}

function parseMessageMeta(msg: any): MessageMeta {
  const headers = msg.payload?.headers || [];
  return {
    id: msg.id,
    from: extractHeader(headers, "From"),
    to: extractHeader(headers, "To"),
    subject: extractHeader(headers, "Subject"),
    date: extractHeader(headers, "Date"),
    listUnsubscribe: extractHeader(headers, "List-Unsubscribe") || undefined,
  };
}

// ── Plugin definition ─────────────────────────────────────────────────

const dynocluxPlugin = {
  id: "dynoclux",
  name: "DynoClux Privacy Enforcement",
  description:
    "Scan Gmail, categorize senders, execute unsubscribes, track CAN-SPAM/CCPA deadlines, detect violations, and draft compliance notices",
  configSchema: {
    type: "object" as const,
    properties: {
      gmailClientId: { type: "string" as const },
      gmailClientSecret: { type: "string" as const },
      gmailRefreshToken: { type: "string" as const },
      convexUrl: { type: "string" as const },
    },
    required: [
      "gmailClientId",
      "gmailClientSecret",
      "gmailRefreshToken",
      "convexUrl",
    ],
  },
  register(pluginApi: any) {
    const gmailClientId = pluginApi.pluginConfig?.gmailClientId;
    const gmailClientSecret = pluginApi.pluginConfig?.gmailClientSecret;
    const gmailRefreshToken = pluginApi.pluginConfig?.gmailRefreshToken;
    const convexUrl = pluginApi.pluginConfig?.convexUrl;

    if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
      pluginApi.logger?.warn?.(
        "dynoclux: Gmail OAuth credentials not configured",
      );
      return;
    }
    if (!convexUrl) {
      pluginApi.logger?.warn?.("dynoclux: convexUrl not configured");
      return;
    }

    async function getAccessToken(): Promise<string> {
      return getGmailAccessToken(
        gmailClientId,
        gmailClientSecret,
        gmailRefreshToken,
      );
    }

    // ── Tool 1: Scan Inbox ────────────────────────────────────────────
    pluginApi.registerTool({
      name: "dynoclux_scan_inbox",
      label: "DynoClux Scan Inbox",
      description:
        "Scan recent emails and categorize senders. Categories: Essential (user replied to), Lapsed (>90 days no interaction), Aggressor (high-frequency marketing). Read-only operation.",
      parameters: Type.Object({
        daysBack: Type.Optional(
          Type.Number({
            description: "Number of days to look back (default: 30)",
          }),
        ),
        maxMessages: Type.Optional(
          Type.Number({
            description: "Max messages to scan (default: 200)",
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const token = await getAccessToken();
          const daysBack = params.daysBack || 30;
          const maxMessages = params.maxMessages || 200;

          const after = Math.floor(
            (Date.now() - daysBack * 86400000) / 1000,
          );
          const query = `after:${after}`;

          // Fetch message list
          const listData = await gmailApi(
            token,
            `messages?q=${encodeURIComponent(query)}&maxResults=${maxMessages}`,
          );
          const messageIds: string[] = (listData.messages || []).map(
            (m: any) => m.id,
          );

          if (messageIds.length === 0) {
            return json({
              totalMessages: 0,
              senders: [],
              message: "No messages found in the specified time range.",
            });
          }

          // Fetch metadata for each message (batched)
          const messages: MessageMeta[] = [];
          for (const id of messageIds) {
            const msg = await gmailApi(
              token,
              `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe`,
            );
            messages.push(parseMessageMeta(msg));
          }

          // Get sent messages to detect replies
          const sentData = await gmailApi(
            token,
            `messages?q=${encodeURIComponent(`in:sent after:${after}`)}&maxResults=${maxMessages}`,
          );
          const sentIds: string[] = (sentData.messages || []).map(
            (m: any) => m.id,
          );
          const sentTos = new Set<string>();
          for (const id of sentIds.slice(0, 100)) {
            const msg = await gmailApi(
              token,
              `messages/${id}?format=metadata&metadataHeaders=To`,
            );
            const to = extractHeader(
              msg.payload?.headers || [],
              "To",
            ).toLowerCase();
            const domain = extractDomain(to);
            if (domain) sentTos.add(domain);
          }

          // Categorize senders
          const senderMap = new Map<
            string,
            {
              email: string;
              domain: string;
              count: number;
              hasUnsubscribe: boolean;
              latestDate: string;
              subjects: string[];
            }
          >();

          for (const msg of messages) {
            const domain = extractDomain(msg.from);
            const existing = senderMap.get(domain);
            if (existing) {
              existing.count++;
              if (msg.listUnsubscribe) existing.hasUnsubscribe = true;
              if (existing.subjects.length < 3) {
                existing.subjects.push(msg.subject);
              }
            } else {
              senderMap.set(domain, {
                email: msg.from,
                domain,
                count: 1,
                hasUnsubscribe: !!msg.listUnsubscribe,
                latestDate: msg.date,
                subjects: [msg.subject],
              });
            }
          }

          const ninetyDaysAgo = Date.now() - 90 * 86400000;

          const senders = Array.from(senderMap.values()).map((s) => {
            let category: string;
            if (sentTos.has(s.domain)) {
              category = "Essential";
            } else if (
              s.count >= 5 &&
              s.hasUnsubscribe
            ) {
              category = "Aggressor";
            } else if (new Date(s.latestDate).getTime() < ninetyDaysAgo) {
              category = "Lapsed";
            } else if (s.hasUnsubscribe) {
              category = "Marketing";
            } else {
              category = "Unknown";
            }
            return { ...s, category };
          });

          senders.sort((a, b) => b.count - a.count);

          // Build category breakdown
          const categoryBreakdown: Record<string, number> = {};
          for (const s of senders) {
            categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1;
          }

          // Persist scan to Convex
          await convexMutation(convexUrl, "inboxScans:create", {
            totalMessages: messages.length,
            uniqueSenders: senders.length,
            senders,
            categoryBreakdown,
          });

          return json({
            totalMessages: messages.length,
            uniqueSenders: senders.length,
            senders,
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });
    // ── Tool 2: Noise Report ──────────────────────────────────────────
    pluginApi.registerTool({
      name: "dynoclux_noise_report",
      label: "DynoClux Noise Report",
      description:
        'Generate a "Complexity Map" summary: total senders, category breakdown, top aggressors, estimated monthly volume. Requires a scan result (run dynoclux_scan_inbox first).',
      parameters: Type.Object({
        scanResult: Type.String({
          description:
            "JSON string of the scan result from dynoclux_scan_inbox",
        }),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const scan = JSON.parse(params.scanResult);
          const senders: any[] = scan.senders || [];

          const categories: Record<string, number> = {};
          let totalVolume = 0;
          for (const s of senders) {
            categories[s.category] = (categories[s.category] || 0) + 1;
            totalVolume += s.count;
          }

          const aggressors = senders
            .filter((s) => s.category === "Aggressor")
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

          const lapsed = senders.filter((s) => s.category === "Lapsed");
          const marketing = senders.filter(
            (s) => s.category === "Marketing" || s.category === "Aggressor",
          );
          const unsubscribable = senders.filter((s) => s.hasUnsubscribe);

          return json({
            summary: {
              totalSenders: senders.length,
              totalMessages: scan.totalMessages || totalVolume,
              categoryBreakdown: categories,
              estimatedMonthlyVolume: Math.round(totalVolume * (30 / 30)),
              unsubscribableSenders: unsubscribable.length,
              lapsedSenders: lapsed.length,
              marketingSenders: marketing.length,
            },
            topAggressors: aggressors.map((a) => ({
              domain: a.domain,
              email: a.email,
              count: a.count,
              hasUnsubscribe: a.hasUnsubscribe,
              sampleSubjects: a.subjects,
            })),
            recommendation: `${unsubscribable.length} senders support List-Unsubscribe. ${aggressors.length} high-frequency aggressors detected. ${lapsed.length} lapsed senders can be cleaned up.`,
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Tool 3: Unsubscribe ───────────────────────────────────────────
    pluginApi.registerTool({
      name: "dynoclux_unsubscribe",
      label: "DynoClux Unsubscribe",
      description:
        "Execute an unsubscribe for a sender. Parses List-Unsubscribe header: supports mailto: (sends email via Gmail) and HTTP one-click POST. Returns a URL for manual action if neither automated method works.",
      parameters: Type.Object({
        senderDomain: Type.String({
          description: "The sender domain to unsubscribe from",
        }),
        listUnsubscribeHeader: Type.Optional(
          Type.String({
            description:
              "The List-Unsubscribe header value. If not provided, will search for a recent message from this sender.",
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const token = await getAccessToken();
          let unsubHeader = params.listUnsubscribeHeader;

          // If no header provided, find a recent message from this sender
          if (!unsubHeader) {
            const searchData = await gmailApi(
              token,
              `messages?q=${encodeURIComponent(`from:${params.senderDomain}`)}&maxResults=5`,
            );
            const msgs = searchData.messages || [];
            for (const m of msgs) {
              const msg = await gmailApi(
                token,
                `messages/${m.id}?format=metadata&metadataHeaders=List-Unsubscribe`,
              );
              const header = extractHeader(
                msg.payload?.headers || [],
                "List-Unsubscribe",
              );
              if (header) {
                unsubHeader = header;
                break;
              }
            }
          }

          if (!unsubHeader) {
            return json({
              success: false,
              method: "none",
              message: `No List-Unsubscribe header found for ${params.senderDomain}. Manual unsubscribe required.`,
            });
          }

          // Parse List-Unsubscribe header — can contain mailto: and/or http: URLs
          const mailtoMatch = unsubHeader.match(/<mailto:([^>]+)>/i);
          const httpMatch = unsubHeader.match(/<(https?:\/\/[^>]+)>/i);

          // Prefer HTTP one-click POST (RFC 8058)
          if (httpMatch) {
            const unsubUrl = httpMatch[1];
            try {
              const res = await fetch(unsubUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: "List-Unsubscribe=One-Click",
              });
              if (res.ok || res.status === 302 || res.status === 301) {
                return json({
                  success: true,
                  method: "http-one-click",
                  url: unsubUrl,
                  message: `Successfully sent one-click unsubscribe POST to ${params.senderDomain}`,
                });
              }
              // If POST fails, return URL for manual action
              return json({
                success: false,
                method: "http-manual",
                url: unsubUrl,
                message: `HTTP one-click POST returned ${res.status}. Open this URL manually to complete unsubscribe.`,
              });
            } catch {
              return json({
                success: false,
                method: "http-manual",
                url: unsubUrl,
                message: `Could not reach unsubscribe URL. Open this URL manually.`,
              });
            }
          }

          // Fallback to mailto:
          if (mailtoMatch) {
            const mailtoAddr = mailtoMatch[1].split("?")[0];
            const subjectMatch = mailtoMatch[1].match(/subject=([^&]*)/i);
            const subject = subjectMatch
              ? decodeURIComponent(subjectMatch[1])
              : "Unsubscribe";

            // Send email via Gmail API
            const rawEmail = [
              `To: ${mailtoAddr}`,
              `Subject: ${subject}`,
              `Content-Type: text/plain; charset=utf-8`,
              "",
              "Unsubscribe",
            ].join("\r\n");

            const encodedEmail = Buffer.from(rawEmail)
              .toString("base64")
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/, "");

            await gmailApi(token, "messages/send", {
              method: "POST",
              body: JSON.stringify({ raw: encodedEmail }),
            });

            return json({
              success: true,
              method: "mailto",
              address: mailtoAddr,
              message: `Sent unsubscribe email to ${mailtoAddr} for ${params.senderDomain}`,
            });
          }

          return json({
            success: false,
            method: "none",
            rawHeader: unsubHeader,
            message:
              "Could not parse List-Unsubscribe header. Manual unsubscribe required.",
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Tool 4: Track Request ─────────────────────────────────────────
    pluginApi.registerTool({
      name: "dynoclux_track_request",
      label: "DynoClux Track Request",
      description:
        "Log an unsubscribe or data deletion request to the enforcement ledger. Calculates deadline: +10 business days for CAN-SPAM, +45 calendar days for CCPA. Stores in Convex.",
      parameters: Type.Object({
        senderEmail: Type.String({ description: "Sender email address" }),
        senderDomain: Type.String({ description: "Sender domain" }),
        requestType: Type.Union([Type.Literal("unsubscribe"), Type.Literal("data_deletion")], {
          description: '"unsubscribe" (CAN-SPAM, 10 biz days) or "data_deletion" (CCPA, 45 cal days)',
        }),
        method: Type.Optional(
          Type.String({
            description:
              'How the request was made: "mailto", "http-one-click", "manual", etc.',
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const now = new Date();
          const deadline =
            params.requestType === "unsubscribe"
              ? addBusinessDays(now, 10)
              : addCalendarDays(now, 45);

          const id = await convexMutation(
            convexUrl,
            "privacyRequests:create",
            {
              senderEmail: params.senderEmail,
              senderDomain: params.senderDomain,
              requestType: params.requestType,
              method: params.method,
              requestedAt: now.getTime(),
              deadline: deadline.getTime(),
            },
          );

          const deadlineStr = deadline.toISOString().split("T")[0];
          const law =
            params.requestType === "unsubscribe"
              ? "CAN-SPAM (10 business days)"
              : "CCPA (45 calendar days)";

          return json({
            success: true,
            requestId: id,
            senderDomain: params.senderDomain,
            requestType: params.requestType,
            deadline: deadlineStr,
            law,
            message: `Request tracked. ${params.senderDomain} must comply by ${deadlineStr} under ${law}.`,
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Tool 5: Check Violations ──────────────────────────────────────
    pluginApi.registerTool({
      name: "dynoclux_check_violations",
      label: "DynoClux Check Violations",
      description:
        "Find post-deadline emails from opted-out senders. Cross-references expired privacy requests with Gmail search. Creates violation records.",
      parameters: Type.Object({}),
      async execute() {
        try {
          const token = await getAccessToken();
          const now = Date.now();

          // Get expired pending requests
          const expired = await convexQuery(
            convexUrl,
            "privacyRequests:listExpired",
            { now },
          );

          if (!expired || expired.length === 0) {
            return json({
              violations: [],
              message: "No expired requests found. All senders are within compliance deadlines.",
            });
          }

          const violations: any[] = [];

          for (const req of expired) {
            // Search for emails from this sender AFTER the deadline
            const afterTs = Math.floor(req.deadline / 1000);
            const searchData = await gmailApi(
              token,
              `messages?q=${encodeURIComponent(`from:${req.senderDomain} after:${afterTs}`)}&maxResults=10`,
            );
            const msgs = searchData.messages || [];

            if (msgs.length > 0) {
              const messageIds = msgs.map((m: any) => m.id);
              const violationType =
                req.requestType === "unsubscribe" ? "canspam" : "ccpa";

              const violationId = await convexMutation(
                convexUrl,
                "privacyViolations:create",
                {
                  requestId: req._id,
                  senderEmail: req.senderEmail,
                  senderDomain: req.senderDomain,
                  violationType,
                  deadlineDate: req.deadline,
                  violationDate: now,
                  messageIds,
                },
              );

              // Mark request as violated
              await convexMutation(
                convexUrl,
                "privacyRequests:updateStatus",
                {
                  id: req._id,
                  status: "violated",
                },
              );

              violations.push({
                violationId,
                senderDomain: req.senderDomain,
                senderEmail: req.senderEmail,
                violationType,
                deadline: new Date(req.deadline).toISOString().split("T")[0],
                messagesAfterDeadline: messageIds.length,
              });
            } else {
              // No messages after deadline — mark as complied
              await convexMutation(
                convexUrl,
                "privacyRequests:updateStatus",
                {
                  id: req._id,
                  status: "complied",
                  resolvedAt: now,
                },
              );
            }
          }

          return json({
            checkedRequests: expired.length,
            violations,
            complied: expired.length - violations.length,
            message:
              violations.length > 0
                ? `${violations.length} violation(s) detected. Use dynoclux_generate_notice to draft compliance notices.`
                : "All expired requests have been complied with.",
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Tool 6: Generate Notice ───────────────────────────────────────
    pluginApi.registerTool({
      name: "dynoclux_generate_notice",
      label: "DynoClux Generate Notice",
      description:
        "Draft a formal Notice of Non-Compliance citing CAN-SPAM (15 USC 7704) or CCPA (1798.105). Draft-only — never sent automatically.",
      parameters: Type.Object({
        violationId: Type.String({
          description: "The violation ID from dynoclux_check_violations",
        }),
        senderName: Type.Optional(
          Type.String({
            description: "Human-readable sender/company name for the notice",
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const violation = await convexQuery(
            convexUrl,
            "privacyViolations:get",
            { id: params.violationId },
          );

          if (!violation) {
            return json({ error: "Violation not found" });
          }

          const senderName =
            params.senderName || violation.senderDomain;
          const deadlineStr = new Date(violation.deadlineDate)
            .toISOString()
            .split("T")[0];
          const violationDateStr = new Date(violation.violationDate)
            .toISOString()
            .split("T")[0];

          let notice: string;

          if (violation.violationType === "canspam") {
            notice = `NOTICE OF NON-COMPLIANCE — CAN-SPAM ACT (15 U.S.C. § 7704)

To: ${senderName} (${violation.senderEmail})
From: [YOUR NAME]
Date: ${new Date().toISOString().split("T")[0]}

RE: Failure to Honor Unsubscribe Request

Dear ${senderName},

On or about ${new Date(violation.deadlineDate - 10 * 86400000).toISOString().split("T")[0]}, I submitted an opt-out request from commercial electronic messages sent by ${senderName} to my email address. Under the CAN-SPAM Act (15 U.S.C. § 7704(a)(3)(A)), you are required to honor such requests within 10 business days.

As of ${violationDateStr}, the compliance deadline of ${deadlineStr} has passed, and I have continued to receive ${violation.messageIds.length} commercial email message(s) from your domain (${violation.senderDomain}) after the deadline.

This constitutes a violation of 15 U.S.C. § 7704(a)(3)(A). Each such message may be subject to penalties of up to $51,744 per violation under 15 U.S.C. § 7706(a).

I demand that you:
1. Immediately cease all commercial electronic messages to my email address
2. Confirm in writing that my address has been permanently removed from all mailing lists
3. Provide an explanation for the failure to honor the original opt-out request

If I do not receive confirmation of compliance within 10 business days of this notice, I reserve the right to file a complaint with the Federal Trade Commission and pursue any other remedies available under law.

Sincerely,
[YOUR NAME]
[YOUR EMAIL ADDRESS]`;
          } else {
            notice = `NOTICE OF NON-COMPLIANCE — CALIFORNIA CONSUMER PRIVACY ACT (Cal. Civ. Code § 1798.105)

To: ${senderName} (${violation.senderEmail})
From: [YOUR NAME]
Date: ${new Date().toISOString().split("T")[0]}

RE: Failure to Honor Data Deletion Request

Dear ${senderName},

On or about ${new Date(violation.deadlineDate - 45 * 86400000).toISOString().split("T")[0]}, I submitted a verifiable request for deletion of my personal information pursuant to the California Consumer Privacy Act (Cal. Civ. Code § 1798.105).

Under CCPA regulations (11 CCR § 7020 et seq.), you were required to respond to this request within 45 calendar days. The compliance deadline of ${deadlineStr} has passed.

As of ${violationDateStr}, I have evidence of ${violation.messageIds.length} communication(s) from your domain (${violation.senderDomain}) indicating that my personal information has not been deleted as requested.

This constitutes a violation of Cal. Civ. Code § 1798.105. Under § 1798.155, violations are subject to civil penalties of up to $2,500 per violation, or $7,500 per intentional violation.

I demand that you:
1. Immediately complete the deletion of all personal information associated with my identity
2. Confirm in writing the categories of information deleted and the date of deletion
3. Direct any service providers to whom my data was disclosed to also delete my information

If I do not receive confirmation of compliance within 15 business days of this notice, I intend to file a complaint with the California Attorney General's office and pursue all remedies available under CCPA, including statutory damages under § 1798.150.

Sincerely,
[YOUR NAME]
[YOUR EMAIL ADDRESS]`;
          }

          // Store the draft on the violation record
          await convexMutation(
            convexUrl,
            "privacyViolations:updateStatus",
            {
              id: params.violationId,
              status: "notice_drafted",
              noticeDraft: notice,
            },
          );

          return json({
            success: true,
            violationId: params.violationId,
            violationType: violation.violationType,
            senderDomain: violation.senderDomain,
            notice,
            message:
              "DRAFT ONLY — This notice has NOT been sent. Review carefully before sending.",
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Tool 7: Evidence Log ──────────────────────────────────────────
    pluginApi.registerTool({
      name: "dynoclux_evidence_log",
      label: "DynoClux Evidence Log",
      description:
        "Export a legal evidence packet for a violation. Fetches full headers from Gmail for violating messages. Assembles JSON packet with timeline.",
      parameters: Type.Object({
        violationId: Type.String({
          description: "The violation ID to gather evidence for",
        }),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const token = await getAccessToken();
          const violation = await convexQuery(
            convexUrl,
            "privacyViolations:get",
            { id: params.violationId },
          );

          if (!violation) {
            return json({ error: "Violation not found" });
          }

          const request = await convexQuery(
            convexUrl,
            "privacyRequests:get",
            { id: violation.requestId },
          );

          // Fetch full headers for each violating message
          const messageEvidence: any[] = [];
          for (const msgId of violation.messageIds) {
            try {
              const msg = await gmailApi(
                token,
                `messages/${msgId}?format=metadata`,
              );
              const headers = msg.payload?.headers || [];
              messageEvidence.push({
                messageId: msgId,
                internalDate: msg.internalDate,
                date: extractHeader(headers, "Date"),
                from: extractHeader(headers, "From"),
                to: extractHeader(headers, "To"),
                subject: extractHeader(headers, "Subject"),
                returnPath: extractHeader(headers, "Return-Path"),
                receivedSpf: extractHeader(headers, "Received-SPF"),
                dkim: extractHeader(headers, "DKIM-Signature"),
                listUnsubscribe: extractHeader(headers, "List-Unsubscribe"),
                allHeaders: headers,
              });
            } catch {
              messageEvidence.push({
                messageId: msgId,
                error: "Could not fetch message — may have been deleted",
              });
            }
          }

          const evidencePacket = {
            caseId: params.violationId,
            generatedAt: new Date().toISOString(),
            violationType:
              violation.violationType === "canspam"
                ? "CAN-SPAM Act (15 U.S.C. § 7704)"
                : "CCPA (Cal. Civ. Code § 1798.105)",
            sender: {
              email: violation.senderEmail,
              domain: violation.senderDomain,
            },
            timeline: {
              requestDate: request
                ? new Date(request.requestedAt).toISOString()
                : "unknown",
              requestMethod: request?.method || "unknown",
              complianceDeadline: new Date(
                violation.deadlineDate,
              ).toISOString(),
              firstViolation: new Date(
                violation.violationDate,
              ).toISOString(),
              totalViolatingMessages: violation.messageIds.length,
            },
            messages: messageEvidence,
            noticeDraft: violation.noticeDraft || null,
          };

          return json({
            evidencePacket,
            message: `Evidence packet assembled with ${messageEvidence.length} message(s). This can be used for FTC/AG complaints.`,
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Tool 8: List Requests ─────────────────────────────────────────
    pluginApi.registerTool({
      name: "dynoclux_list_requests",
      label: "DynoClux List Requests",
      description:
        "List all tracked privacy requests and their status. Shows pending, complied, and violated requests with days remaining until deadline.",
      parameters: Type.Object({
        status: Type.Optional(
          Type.Union(
            [
              Type.Literal("pending"),
              Type.Literal("complied"),
              Type.Literal("violated"),
            ],
            {
              description:
                'Filter by status: "pending", "complied", or "violated". Omit for all.',
            },
          ),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const args: Record<string, unknown> = {};
          if (params.status) args.status = params.status;

          const requests = await convexQuery(
            convexUrl,
            "privacyRequests:list",
            args,
          );

          const now = Date.now();
          const enriched = (requests || []).map((r: any) => {
            const daysRemaining = Math.ceil(
              (r.deadline - now) / 86400000,
            );
            return {
              id: r._id,
              senderEmail: r.senderEmail,
              senderDomain: r.senderDomain,
              requestType: r.requestType,
              method: r.method,
              status: r.status,
              requestedAt: new Date(r.requestedAt).toISOString().split("T")[0],
              deadline: new Date(r.deadline).toISOString().split("T")[0],
              daysRemaining: r.status === "pending" ? daysRemaining : null,
              overdue: r.status === "pending" && daysRemaining < 0,
              resolvedAt: r.resolvedAt
                ? new Date(r.resolvedAt).toISOString().split("T")[0]
                : null,
            };
          });

          const pending = enriched.filter((r: any) => r.status === "pending");
          const overdue = pending.filter((r: any) => r.overdue);

          return json({
            total: enriched.length,
            pending: pending.length,
            overdue: overdue.length,
            requests: enriched,
            message:
              overdue.length > 0
                ? `${overdue.length} request(s) are overdue. Run dynoclux_check_violations to detect violations.`
                : `${pending.length} pending request(s). All within compliance windows.`,
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Tool 9: Process Action Queue ──────────────────────────────────
    pluginApi.registerTool({
      name: "dynoclux_process_queue",
      label: "DynoClux Process Queue",
      description:
        "Process pending actions from the DynoClux action queue. Picks up actions queued from the canvas dashboard (unsubscribe, track_request, request_removal, block, archive) and executes them. Call this when asked to process the queue or check for pending actions.",
      parameters: Type.Object({}),
      async execute() {
        try {
          const token = await getAccessToken();
          const pending = await convexQuery(
            convexUrl,
            "actionQueue:listPending",
          );

          if (!pending || pending.length === 0) {
            return json({
              processed: 0,
              message: "No pending actions in the queue.",
            });
          }

          const results: any[] = [];

          for (const item of pending) {
            // Claim the item
            const claimed = await convexMutation(
              convexUrl,
              "actionQueue:claim",
              { id: item._id },
            );
            if (!claimed) {
              results.push({
                id: item._id,
                action: item.action,
                status: "skipped",
                reason: "Already claimed or not pending",
              });
              continue;
            }

            try {
              if (item.action === "unsubscribe") {
                // Reuse unsubscribe logic: find List-Unsubscribe header and execute
                let unsubHeader: string | null = null;
                const searchData = await gmailApi(
                  token,
                  `messages?q=${encodeURIComponent(`from:${item.senderDomain}`)}&maxResults=5`,
                );
                const msgs = searchData.messages || [];
                for (const m of msgs) {
                  const msg = await gmailApi(
                    token,
                    `messages/${m.id}?format=metadata&metadataHeaders=List-Unsubscribe`,
                  );
                  const header = extractHeader(
                    msg.payload?.headers || [],
                    "List-Unsubscribe",
                  );
                  if (header) {
                    unsubHeader = header;
                    break;
                  }
                }

                if (!unsubHeader) {
                  await convexMutation(convexUrl, "actionQueue:complete", {
                    id: item._id,
                    result: `No List-Unsubscribe header found for ${item.senderDomain}. Manual unsubscribe required.`,
                  });
                  results.push({
                    id: item._id,
                    action: "unsubscribe",
                    status: "done",
                    result: "No unsubscribe header found",
                  });
                  continue;
                }

                const httpMatch = unsubHeader.match(/<(https?:\/\/[^>]+)>/i);
                const mailtoMatch = unsubHeader.match(/<mailto:([^>]+)>/i);
                let method = "none";
                let resultMsg = "";

                if (httpMatch) {
                  try {
                    const res = await fetch(httpMatch[1], {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                      },
                      body: "List-Unsubscribe=One-Click",
                    });
                    if (
                      res.ok ||
                      res.status === 302 ||
                      res.status === 301
                    ) {
                      method = "http-one-click";
                      resultMsg = `Unsubscribed from ${item.senderDomain} via HTTP one-click`;
                    } else {
                      method = "http-failed";
                      resultMsg = `HTTP one-click returned ${res.status} for ${item.senderDomain}`;
                    }
                  } catch {
                    method = "http-failed";
                    resultMsg = `Could not reach unsubscribe URL for ${item.senderDomain}`;
                  }
                } else if (mailtoMatch) {
                  const mailtoAddr = mailtoMatch[1].split("?")[0];
                  const subjectMatch =
                    mailtoMatch[1].match(/subject=([^&]*)/i);
                  const subject = subjectMatch
                    ? decodeURIComponent(subjectMatch[1])
                    : "Unsubscribe";

                  const rawEmail = [
                    `To: ${mailtoAddr}`,
                    `Subject: ${subject}`,
                    `Content-Type: text/plain; charset=utf-8`,
                    "",
                    "Unsubscribe",
                  ].join("\r\n");

                  const encodedEmail = Buffer.from(rawEmail)
                    .toString("base64")
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
                    .replace(/=+$/, "");

                  await gmailApi(token, "messages/send", {
                    method: "POST",
                    body: JSON.stringify({ raw: encodedEmail }),
                  });

                  method = "mailto";
                  resultMsg = `Sent unsubscribe email to ${mailtoAddr} for ${item.senderDomain}`;
                } else {
                  resultMsg = `Could not parse List-Unsubscribe header for ${item.senderDomain}`;
                }

                await convexMutation(convexUrl, "actionQueue:complete", {
                  id: item._id,
                  result: resultMsg,
                });
                results.push({
                  id: item._id,
                  action: "unsubscribe",
                  status: "done",
                  method,
                  result: resultMsg,
                });
              } else if (item.action === "track_request") {
                // Reuse track request logic
                const now = new Date();
                const deadline = addBusinessDays(now, 10);

                await convexMutation(
                  convexUrl,
                  "privacyRequests:create",
                  {
                    senderEmail: item.senderEmail,
                    senderDomain: item.senderDomain,
                    requestType: "unsubscribe",
                    method: "dashboard-queue",
                    requestedAt: now.getTime(),
                    deadline: deadline.getTime(),
                  },
                );

                const deadlineStr = deadline.toISOString().split("T")[0];
                const resultMsg = `Tracked unsubscribe request for ${item.senderDomain}. Deadline: ${deadlineStr} (CAN-SPAM, 10 biz days).`;

                await convexMutation(convexUrl, "actionQueue:complete", {
                  id: item._id,
                  result: resultMsg,
                });
                results.push({
                  id: item._id,
                  action: "track_request",
                  status: "done",
                  result: resultMsg,
                });
              } else if (item.action === "request_removal") {
                // Search Gmail for a recent message from this sender to get the actual From address
                let fromAddress = item.senderEmail;
                const searchData = await gmailApi(
                  token,
                  `messages?q=${encodeURIComponent(`from:${item.senderDomain}`)}&maxResults=1`,
                );
                const msgs = searchData.messages || [];
                if (msgs.length > 0) {
                  const msg = await gmailApi(
                    token,
                    `messages/${msgs[0].id}?format=metadata&metadataHeaders=From`,
                  );
                  const fromHeader = extractHeader(msg.payload?.headers || [], "From");
                  if (fromHeader) fromAddress = fromHeader;
                }

                // Compose formal GDPR Art. 17 / CAN-SPAM removal request email
                const recipientDomain = item.senderDomain;
                const removalBody = [
                  `To Whom It May Concern,`,
                  ``,
                  `I am writing to formally request the immediate removal of my email address from all mailing lists, databases, and marketing systems operated by or on behalf of ${recipientDomain}.`,
                  ``,
                  `This request is made pursuant to:`,
                  `- The CAN-SPAM Act (15 U.S.C. § 7704), which requires commercial email senders to honor opt-out requests within 10 business days`,
                  `- The General Data Protection Regulation (GDPR), Article 17 ("Right to Erasure"), which grants data subjects the right to obtain erasure of personal data without undue delay`,
                  ``,
                  `I request that you:`,
                  `1. Remove my email address from all mailing lists and marketing databases`,
                  `2. Cease all commercial electronic messages to my address`,
                  `3. Direct any third-party processors or affiliates to do the same`,
                  `4. Confirm completion of this request within 10 business days`,
                  ``,
                  `Failure to comply may constitute a violation of 15 U.S.C. § 7704(a)(3)(A) (penalties up to $51,744 per message) and/or GDPR Article 83 (administrative fines up to €20 million or 4% of annual global turnover).`,
                  ``,
                  `Thank you for your prompt attention to this matter.`,
                ].join("\r\n");

                const rawEmail = [
                  `To: ${fromAddress}`,
                  `Subject: Data Removal Request — ${recipientDomain}`,
                  `Content-Type: text/plain; charset=utf-8`,
                  "",
                  removalBody,
                ].join("\r\n");

                const encodedEmail = Buffer.from(rawEmail)
                  .toString("base64")
                  .replace(/\+/g, "-")
                  .replace(/\//g, "_")
                  .replace(/=+$/, "");

                await gmailApi(token, "messages/send", {
                  method: "POST",
                  body: JSON.stringify({ raw: encodedEmail }),
                });

                // Auto-create privacy request with 10 business day deadline
                const now = new Date();
                const deadline = addBusinessDays(now, 10);

                await convexMutation(
                  convexUrl,
                  "privacyRequests:create",
                  {
                    senderEmail: item.senderEmail,
                    senderDomain: item.senderDomain,
                    requestType: "unsubscribe",
                    method: "removal-request-email",
                    requestedAt: now.getTime(),
                    deadline: deadline.getTime(),
                  },
                );

                const deadlineStr = deadline.toISOString().split("T")[0];
                const resultMsg = `Sent formal removal request to ${fromAddress} for ${item.senderDomain}. Privacy request tracked with deadline ${deadlineStr}.`;

                await convexMutation(convexUrl, "actionQueue:complete", {
                  id: item._id,
                  result: resultMsg,
                });
                results.push({
                  id: item._id,
                  action: "request_removal",
                  status: "done",
                  result: resultMsg,
                });
              } else if (item.action === "archive") {
                // Archive all messages from this sender's domain
                const searchData = await gmailApi(
                  token,
                  `messages?q=${encodeURIComponent(`from:${item.senderDomain} in:inbox`)}&maxResults=500`,
                );
                const msgs = searchData.messages || [];

                if (msgs.length === 0) {
                  const resultMsg = `No inbox messages found from ${item.senderDomain}.`;
                  await convexMutation(convexUrl, "actionQueue:complete", {
                    id: item._id,
                    result: resultMsg,
                  });
                  results.push({
                    id: item._id,
                    action: "archive",
                    status: "done",
                    result: resultMsg,
                  });
                  continue;
                }

                // Batch modify — remove INBOX label to archive
                const messageIds = msgs.map((m: any) => m.id);
                await gmailApi(token, "messages/batchModify", {
                  method: "POST",
                  body: JSON.stringify({
                    ids: messageIds,
                    removeLabelIds: ["INBOX"],
                  }),
                });

                const resultMsg = `Archived ${messageIds.length} message(s) from ${item.senderDomain}.`;
                await convexMutation(convexUrl, "actionQueue:complete", {
                  id: item._id,
                  result: resultMsg,
                });
                results.push({
                  id: item._id,
                  action: "archive",
                  status: "done",
                  result: resultMsg,
                });
              } else if (item.action === "block") {
                // Create a Gmail filter to auto-trash messages from this sender's domain
                await gmailApi(token, "settings/filters", {
                  method: "POST",
                  body: JSON.stringify({
                    criteria: { from: item.senderDomain },
                    action: {
                      removeLabelIds: ["INBOX"],
                      addLabelIds: ["TRASH"],
                    },
                  }),
                });

                const resultMsg = `Blocked ${item.senderDomain} — future messages will be auto-trashed.`;

                await convexMutation(convexUrl, "actionQueue:complete", {
                  id: item._id,
                  result: resultMsg,
                });
                results.push({
                  id: item._id,
                  action: "block",
                  status: "done",
                  result: resultMsg,
                });
              } else {
                await convexMutation(convexUrl, "actionQueue:fail", {
                  id: item._id,
                  error: `Unknown action: ${item.action}`,
                });
                results.push({
                  id: item._id,
                  action: item.action,
                  status: "error",
                  error: `Unknown action: ${item.action}`,
                });
              }
            } catch (execErr) {
              const errMsg =
                execErr instanceof Error
                  ? execErr.message
                  : String(execErr);
              await convexMutation(convexUrl, "actionQueue:fail", {
                id: item._id,
                error: errMsg,
              });
              results.push({
                id: item._id,
                action: item.action,
                status: "error",
                error: errMsg,
              });
            }
          }

          const done = results.filter((r) => r.status === "done").length;
          const errored = results.filter((r) => r.status === "error").length;
          const skipped = results.filter(
            (r) => r.status === "skipped",
          ).length;

          return json({
            processed: results.length,
            done,
            errored,
            skipped,
            results,
            message: `Processed ${results.length} action(s): ${done} done, ${errored} error(s), ${skipped} skipped.`,
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

export default dynocluxPlugin;
