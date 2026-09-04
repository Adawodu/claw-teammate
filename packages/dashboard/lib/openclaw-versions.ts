const REGISTRY = "https://registry.npmjs.org/openclaw";
const TTL_MS = 5 * 60 * 1000;

type Cache = { value: string[]; latest: string; at: number } | null;
let cache: Cache = null;

async function loadFromRegistry(): Promise<{ latest: string; recent: string[] }> {
  const [latestRes, allRes] = await Promise.all([
    fetch(`${REGISTRY}/latest`, { cache: "no-store" }),
    fetch(REGISTRY, { cache: "no-store" }),
  ]);
  if (!latestRes.ok) throw new Error(`npm registry /latest ${latestRes.status}`);
  if (!allRes.ok) throw new Error(`npm registry ${allRes.status}`);
  const latestJson = (await latestRes.json()) as { version?: string };
  const allJson = (await allRes.json()) as { time?: Record<string, string> };
  const latest = latestJson.version;
  if (!latest) throw new Error("npm registry returned no latest version");

  // Recent stable versions, newest first, excluding pre-releases.
  const time = allJson.time ?? {};
  const stable = Object.entries(time)
    .filter(([v]) => v !== "created" && v !== "modified" && !v.includes("-"))
    .sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .slice(0, 12)
    .map(([v]) => v);

  // Ensure latest is first even if registry ordering is off.
  const recent = [latest, ...stable.filter((v) => v !== latest)].slice(0, 12);
  return { latest, recent };
}

export async function getLatestOpenClawVersion(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.latest;
  const { latest, recent } = await loadFromRegistry();
  cache = { latest, value: recent, at: now };
  return latest;
}

export async function getRecentOpenClawVersions(): Promise<{ latest: string; recent: string[] }> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return { latest: cache.latest, recent: cache.value };
  }
  const fresh = await loadFromRegistry();
  cache = { latest: fresh.latest, value: fresh.recent, at: now };
  return fresh;
}
