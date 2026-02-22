import open from "open";

export async function openUrl(url: string): Promise<void> {
  try {
    await open(url);
  } catch {
    // Silently fail — user can manually open the URL
  }
}
