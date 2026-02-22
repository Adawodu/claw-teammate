export function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function ago(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export interface ActivityRow {
  date: string;
  model: string;
  usageUsd: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
}

export function aggregateByModel(activity: ActivityRow[]) {
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
  return [...map.entries()].sort((a, b) => b[1].usageUsd - a[1].usageUsd);
}

export function aggregateByDate(activity: ActivityRow[]) {
  const map = new Map<string, number>();
  for (const r of activity) {
    map.set(r.date, (map.get(r.date) ?? 0) + r.usageUsd);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function maskApiKey(value: string): string {
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}
