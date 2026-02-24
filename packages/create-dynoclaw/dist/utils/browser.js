import open from "open";
export async function openUrl(url) {
    try {
        await open(url);
    }
    catch {
        // Silently fail — user can manually open the URL
    }
}
//# sourceMappingURL=browser.js.map