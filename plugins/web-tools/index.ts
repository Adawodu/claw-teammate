import { Type } from "@sinclair/typebox";
import * as cheerio from "cheerio";
import pdf from "pdf-parse";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

const webToolsPlugin = {
  id: "web-tools",
  name: "Web Tools",
  description: "Crawl websites and extract text from PDF files",
  configSchema: {
    type: "object" as const,
    properties: {},
    required: [] as string[],
  },
  register(pluginApi: any) {
    // ── Crawl a website ──────────────────────────────────────────────
    pluginApi.registerTool({
      name: "crawl_website",
      label: "Crawl Website",
      description:
        "Crawl a website starting from a URL. Fetches the page, extracts text content and links, " +
        "then follows links matching the same domain (up to a configurable depth and page limit). " +
        "Returns the text content and metadata from each crawled page. " +
        "Use linkPattern to filter which links to follow (e.g. '/jobs/' to only follow job listing links).",
      parameters: Type.Object({
        url: Type.String({
          description: "The starting URL to crawl (e.g. https://careers.tiktok.com/jobs)",
        }),
        maxPages: Type.Optional(
          Type.Number({
            description:
              "Maximum number of pages to crawl (default: 10, max: 25). Each page is fetched and parsed.",
          }),
        ),
        maxDepth: Type.Optional(
          Type.Number({
            description:
              "Maximum link-following depth from the start URL (default: 2). Depth 0 = start page only.",
          }),
        ),
        linkPattern: Type.Optional(
          Type.String({
            description:
              'Regex pattern to filter which links to follow. Only links whose href matches this pattern are crawled. ' +
              'Examples: "/jobs/" to only follow job links, "/product|/about" for product and about pages.',
          }),
        ),
        extractSelector: Type.Optional(
          Type.String({
            description:
              'CSS selector to extract specific content from each page (e.g. "article", ".job-listing", "main"). ' +
              "If not provided, extracts all visible text from the page body.",
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const startUrl = params.url;
          const maxPages = Math.min(params.maxPages || 10, 25);
          const maxDepth = Math.min(params.maxDepth ?? 2, 5);
          const linkPattern = params.linkPattern
            ? new RegExp(params.linkPattern, "i")
            : null;
          const extractSelector = params.extractSelector || null;

          const startOrigin = new URL(startUrl).origin;
          const visited = new Set<string>();
          const results: Array<{
            url: string;
            title: string;
            depth: number;
            text: string;
            links: string[];
          }> = [];

          // BFS crawl
          const queue: Array<{ url: string; depth: number }> = [
            { url: startUrl, depth: 0 },
          ];

          while (queue.length > 0 && results.length < maxPages) {
            const item = queue.shift()!;
            const normalized = item.url.split("#")[0].replace(/\/+$/, "");
            if (visited.has(normalized)) continue;
            visited.add(normalized);

            try {
              const res = await fetch(item.url, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (compatible; DynoClaw/1.0; +https://dynoclaw.com)",
                  Accept: "text/html,application/xhtml+xml",
                },
                redirect: "follow",
                signal: AbortSignal.timeout(15000),
              });

              if (!res.ok) continue;

              const contentType = res.headers.get("content-type") || "";
              if (!contentType.includes("text/html")) continue;

              const html = await res.text();
              const $ = cheerio.load(html);

              // Remove script, style, nav, footer noise
              $("script, style, noscript, svg, iframe").remove();

              const title = $("title").text().trim();
              const text = extractSelector
                ? $(extractSelector)
                    .map((_, el) => $(el).text())
                    .get()
                    .join("\n\n")
                    .replace(/\s+/g, " ")
                    .trim()
                : $("body")
                    .text()
                    .replace(/\s+/g, " ")
                    .trim();

              // Extract links for further crawling
              const pageLinks: string[] = [];
              if (item.depth < maxDepth) {
                $("a[href]").each((_, el) => {
                  try {
                    const href = $(el).attr("href");
                    if (!href) return;
                    const abs = new URL(href, item.url).toString();
                    const absNormalized = abs.split("#")[0].replace(/\/+$/, "");

                    // Same origin only
                    if (!abs.startsWith(startOrigin)) return;
                    // Already visited
                    if (visited.has(absNormalized)) return;
                    // Apply link pattern filter
                    if (linkPattern && !linkPattern.test(abs)) return;
                    // Skip non-page resources
                    if (/\.(jpg|png|gif|svg|css|js|zip|pdf|mp4|mp3)$/i.test(abs)) return;

                    pageLinks.push(abs);
                  } catch {
                    // Invalid URL — skip
                  }
                });
              }

              // Truncate text to avoid overwhelming context
              const truncatedText =
                text.length > 3000
                  ? text.slice(0, 3000) + "... [truncated]"
                  : text;

              results.push({
                url: item.url,
                title,
                depth: item.depth,
                text: truncatedText,
                links: pageLinks.slice(0, 20),
              });

              // Enqueue discovered links
              for (const link of pageLinks) {
                if (results.length + queue.length < maxPages * 2) {
                  queue.push({ url: link, depth: item.depth + 1 });
                }
              }
            } catch (err) {
              // Page fetch failed — skip and continue crawling
              results.push({
                url: item.url,
                title: "[fetch failed]",
                depth: item.depth,
                text:
                  err instanceof Error
                    ? `Error: ${err.message}`
                    : "Error: unknown",
                links: [],
              });
            }
          }

          return json({
            startUrl,
            pagesCrawled: results.length,
            maxPagesLimit: maxPages,
            maxDepthLimit: maxDepth,
            linkPatternUsed: params.linkPattern || null,
            pages: results,
          });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // ── Read a PDF ───────────────────────────────────────────────────
    pluginApi.registerTool({
      name: "read_pdf",
      label: "Read PDF",
      description:
        "Download a PDF from a URL and extract its text content. " +
        "Works with any publicly accessible PDF URL, including Telegram file URLs. " +
        "Returns the full text content of the PDF, page count, and metadata.",
      parameters: Type.Object({
        url: Type.String({
          description:
            "URL of the PDF file to read. Can be any HTTP/HTTPS URL that serves a PDF.",
        }),
        maxPages: Type.Optional(
          Type.Number({
            description:
              "Maximum number of pages to extract (default: all pages). Use to limit output for very large PDFs.",
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const res = await fetch(params.url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; DynoClaw/1.0; +https://dynoclaw.com)",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(30000),
          });

          if (!res.ok) {
            return json({
              error: `Failed to download PDF: HTTP ${res.status} ${res.statusText}`,
            });
          }

          const buffer = Buffer.from(await res.arrayBuffer());

          const options: any = {};
          if (params.maxPages) {
            options.max = params.maxPages;
          }

          const data = await pdf(buffer, options);

          // Truncate very large PDFs to avoid context overflow
          const maxChars = 15000;
          const text =
            data.text.length > maxChars
              ? data.text.slice(0, maxChars) + "\n\n... [truncated — use maxPages to limit]"
              : data.text;

          return json({
            pageCount: data.numpages,
            textLength: data.text.length,
            truncated: data.text.length > maxChars,
            metadata: data.info || {},
            text,
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

export default webToolsPlugin;
