import { readFile } from "node:fs/promises";
export const BUILT_IN_PRESETS = {
    "social-media-manager": {
        presetName: "Social Media Manager",
        branding: {
            botName: "SocialClaw",
            personality: "A sharp social media strategist focused on engagement and brand voice",
        },
        plugins: {
            postiz: true,
            "image-gen": true,
            "video-gen": true,
            "convex-knowledge": true,
            beehiiv: false,
        },
        skills: {
            "daily-posts": true,
            "content-engine": true,
            "engagement-monitor": true,
            "daily-briefing": true,
            "newsletter-writer": false,
            "job-hunter": false,
        },
        models: {
            primary: "google/gemini-2.5-flash",
            fallbacks: [
                "anthropic/claude-sonnet-4-5-20250929",
                "openai/gpt-4o-mini",
            ],
        },
    },
    "content-creator": {
        presetName: "Content Creator",
        branding: {
            botName: "CreatorClaw",
            personality: "A creative content strategist who crafts compelling narratives",
        },
        plugins: {
            postiz: true,
            "image-gen": true,
            "video-gen": true,
            "convex-knowledge": true,
            beehiiv: true,
        },
        skills: {
            "daily-posts": true,
            "content-engine": true,
            "engagement-monitor": true,
            "daily-briefing": true,
            "newsletter-writer": true,
            "job-hunter": false,
        },
        models: {
            primary: "google/gemini-2.5-flash",
            fallbacks: [
                "anthropic/claude-sonnet-4-5-20250929",
                "openai/gpt-4o-mini",
            ],
        },
    },
    "full-stack": {
        presetName: "Full Stack (All Features)",
        branding: {
            botName: "Claw",
            personality: "A helpful AI teammate",
        },
        plugins: {
            postiz: true,
            "image-gen": true,
            "video-gen": true,
            "convex-knowledge": true,
            beehiiv: true,
        },
        skills: {
            "daily-posts": true,
            "content-engine": true,
            "engagement-monitor": true,
            "daily-briefing": true,
            "newsletter-writer": true,
            "job-hunter": true,
        },
        models: {
            primary: "google/gemini-2.5-flash",
            fallbacks: [
                "anthropic/claude-sonnet-4-5-20250929",
                "openai/gpt-4o-mini",
            ],
        },
    },
};
export async function loadPreset(source) {
    // Built-in preset name
    if (source in BUILT_IN_PRESETS) {
        return BUILT_IN_PRESETS[source];
    }
    // URL
    if (source.startsWith("http://") || source.startsWith("https://")) {
        const res = await fetch(source);
        if (!res.ok)
            throw new Error(`Failed to fetch preset from ${source}: ${res.statusText}`);
        return (await res.json());
    }
    // Local file
    const content = await readFile(source, "utf-8");
    return JSON.parse(content);
}
//# sourceMappingURL=presets.js.map