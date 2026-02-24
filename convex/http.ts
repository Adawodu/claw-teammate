import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// ─── Dashboard (HTML) ───────────────────────────────────────────────
http.route({
  path: "/dashboard",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const snapshot = await ctx.runQuery(api.costs.latestSnapshot);
    const activity = await ctx.runQuery(api.costs.recentActivity, { days: 30 });

    const html = renderDashboard(snapshot, activity);
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }),
});

// ─── Plain-text summary (for Telegram) ──────────────────────────────
http.route({
  path: "/costs-summary",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const snapshot = await ctx.runQuery(api.costs.latestSnapshot);
    const activity = await ctx.runQuery(api.costs.recentActivity, { days: 30 });

    const text = renderSummary(snapshot, activity);
    return new Response(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }),
});

// ─── Storage proxy with file extension (for Postiz/Twitter) ─────────
http.route({
  pathPrefix: "/storage/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    // Path: /storage/{storageId}.{ext}
    const segment = url.pathname.replace("/storage/", "");
    const storageId = segment.replace(/\.(png|jpg|jpeg|gif|webp|mp4)$/i, "");

    if (!storageId) {
      return new Response("Missing storage ID", { status: 400 });
    }

    const blobUrl = await ctx.storage.getUrl(storageId as any);
    if (!blobUrl) {
      return new Response("Not found", { status: 404 });
    }

    // Fetch the blob and proxy it through
    const blob = await fetch(blobUrl);
    return new Response(blob.body, {
      headers: {
        "Content-Type": blob.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }),
});

export default http;

// ─── Helpers ────────────────────────────────────────────────────────

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function ago(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

interface Snapshot {
  fetchedAt: number;
  openrouterBalance: number;
  openrouterUsed30d: number;
  openaiCostToday: number;
  openaiCostMtd: number;
  gcpEstimateMo: number;
  error?: string;
}

interface ActivityRow {
  date: string;
  model: string;
  usageUsd: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
}

function aggregateByModel(activity: ActivityRow[]) {
  const map = new Map<
    string,
    { usageUsd: number; requests: number; tokens: number }
  >();
  for (const r of activity) {
    const existing = map.get(r.model) ?? { usageUsd: 0, requests: 0, tokens: 0 };
    existing.usageUsd += r.usageUsd;
    existing.requests += r.requests;
    existing.tokens += r.promptTokens + r.completionTokens + r.reasoningTokens;
    map.set(r.model, existing);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].usageUsd - a[1].usageUsd);
}

function aggregateByDate(activity: ActivityRow[]) {
  const map = new Map<string, number>();
  for (const r of activity) {
    map.set(r.date, (map.get(r.date) ?? 0) + r.usageUsd);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

// ─── HTML Dashboard ─────────────────────────────────────────────────

function renderDashboard(
  snapshot: Snapshot | null,
  activity: ActivityRow[]
): string {
  const s = snapshot;
  const modelRows = aggregateByModel(activity);
  const dailyRows = aggregateByDate(activity);
  const monthlyTotal = s
    ? s.openrouterUsed30d + s.openaiCostMtd + s.gcpEstimateMo
    : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DynoClaw — Cost Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    background: #0d1117; color: #c9d1d9;
    display: flex; justify-content: center; padding: 24px 16px;
  }
  .wrap { max-width: 720px; width: 100%; }
  h1 { color: #58a6ff; font-size: 1.5rem; margin-bottom: 8px; }
  .subtitle { color: #8b949e; font-size: 0.85rem; margin-bottom: 24px; }
  .card {
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 20px; margin-bottom: 16px;
  }
  .card h2 { color: #58a6ff; font-size: 1.1rem; margin-bottom: 12px; }
  .stat-row { display: flex; justify-content: space-between; padding: 6px 0; }
  .stat-label { color: #8b949e; }
  .stat-value { color: #c9d1d9; font-weight: 600; }
  .total { color: #f0883e; font-size: 1.3rem; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; color: #8b949e; font-size: 0.8rem; padding: 6px 4px; border-bottom: 1px solid #30363d; }
  td { padding: 6px 4px; font-size: 0.85rem; border-bottom: 1px solid #21262d; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .error { background: #3d1f1f; border-color: #6e3630; color: #f85149; font-size: 0.85rem; }
  .note { color: #8b949e; font-size: 0.8rem; font-style: italic; }
  @media (max-width: 480px) {
    .stat-row { flex-direction: column; gap: 2px; }
    td, th { font-size: 0.75rem; padding: 4px 2px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>DynoClaw — Costs</h1>
  <div class="subtitle">${s ? `Last updated: ${ago(s.fetchedAt)} (${new Date(s.fetchedAt).toUTCString()})` : "No data yet — trigger a fetch from the Convex dashboard"}</div>

  ${s?.error ? `<div class="card error">Errors: ${escapeHtml(s.error)}</div>` : ""}

  <!-- Monthly Total -->
  <div class="card">
    <h2>Monthly Estimate</h2>
    <div class="stat-row">
      <span class="stat-label">All services (rolling 30d)</span>
      <span class="total">${usd(monthlyTotal)}</span>
    </div>
  </div>

  <!-- OpenRouter -->
  <div class="card">
    <h2>OpenRouter</h2>
    <div class="stat-row">
      <span class="stat-label">Balance (credits remaining)</span>
      <span class="stat-value">${s ? usd(s.openrouterBalance) : "—"}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Used (30d)</span>
      <span class="stat-value">${s ? usd(s.openrouterUsed30d) : "—"}</span>
    </div>

    ${modelRows.length > 0 ? `
    <h2 style="margin-top:16px;">Per-Model Breakdown (30d)</h2>
    <table>
      <tr><th>Model</th><th style="text-align:right">Cost</th><th style="text-align:right">Requests</th><th style="text-align:right">Tokens</th></tr>
      ${modelRows.map(([model, d]) => `
      <tr>
        <td>${escapeHtml(model)}</td>
        <td class="num">${usd(d.usageUsd)}</td>
        <td class="num">${d.requests.toLocaleString()}</td>
        <td class="num">${d.tokens.toLocaleString()}</td>
      </tr>`).join("")}
    </table>` : ""}

    ${dailyRows.length > 0 ? `
    <h2 style="margin-top:16px;">Daily Spend (OpenRouter)</h2>
    <table>
      <tr><th>Date</th><th style="text-align:right">Cost</th></tr>
      ${dailyRows.slice(0, 14).map(([date, cost]) => `
      <tr><td>${date}</td><td class="num">${usd(cost)}</td></tr>`).join("")}
    </table>` : ""}
  </div>

  <!-- OpenAI -->
  <div class="card">
    <h2>OpenAI (Embeddings)</h2>
    <div class="stat-row">
      <span class="stat-label">Today</span>
      <span class="stat-value">${s ? usd(s.openaiCostToday) : "—"}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Month-to-date</span>
      <span class="stat-value">${s ? usd(s.openaiCostMtd) : "—"}</span>
    </div>
  </div>

  <!-- GCP -->
  <div class="card">
    <h2>GCP Compute (e2-small)</h2>
    <div class="stat-row">
      <span class="stat-label">Estimated monthly</span>
      <span class="stat-value">${usd(GCP_ESTIMATE)}</span>
    </div>
    <p class="note">Static estimate — no billing API connected.</p>
  </div>

  <!-- Convex -->
  <div class="card">
    <h2>Convex</h2>
    <div class="stat-row">
      <span class="stat-label">Current plan</span>
      <span class="stat-value">Free tier</span>
    </div>
    <p class="note">Vector DB, crons, HTTP endpoints — all within free limits.</p>
  </div>
</div>
</body>
</html>`;
}

const GCP_ESTIMATE = 12.23;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Plain-text summary ─────────────────────────────────────────────

function renderSummary(
  snapshot: Snapshot | null,
  activity: ActivityRow[]
): string {
  if (!snapshot) return "No cost data yet. Trigger a fetch from the Convex dashboard.";

  const s = snapshot;
  const modelRows = aggregateByModel(activity);
  const monthlyTotal = s.openrouterUsed30d + s.openaiCostMtd + s.gcpEstimateMo;

  let text = `DYNOCLAW — COST SUMMARY\n`;
  text += `Updated: ${new Date(s.fetchedAt).toUTCString()}\n\n`;
  text += `MONTHLY ESTIMATE: ${usd(monthlyTotal)}\n\n`;
  text += `OpenRouter balance: ${usd(s.openrouterBalance)}\n`;
  text += `OpenRouter used (30d): ${usd(s.openrouterUsed30d)}\n`;
  text += `OpenAI today: ${usd(s.openaiCostToday)}\n`;
  text += `OpenAI MTD: ${usd(s.openaiCostMtd)}\n`;
  text += `GCP estimate: ${usd(s.gcpEstimateMo)}/mo\n`;
  text += `Convex: Free tier\n`;

  if (modelRows.length > 0) {
    text += `\nTOP MODELS (30d):\n`;
    for (const [model, d] of modelRows.slice(0, 10)) {
      text += `  ${model}: ${usd(d.usageUsd)} (${d.requests} reqs)\n`;
    }
  }

  if (s.error) {
    text += `\nERRORS: ${s.error}\n`;
  }

  text += `\nDashboard: https://fortunate-seahorse-362.convex.site/dashboard`;
  return text;
}
