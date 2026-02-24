export const SKILL_REGISTRY = [
    {
        id: "daily-briefing",
        name: "Daily Briefing",
        description: "Morning news briefing across tech, health IT, Africa, and fintech",
        cron: "0 13 * * *",
        cronDescription: "Daily at 1:00 PM UTC",
        requiredPlugins: [],
    },
    {
        id: "content-engine",
        name: "Content Engine",
        description: "Weekly content calendar generation from trending topics",
        cron: "0 1 * * 1",
        cronDescription: "Mondays at 1:00 AM UTC",
        requiredPlugins: ["convex-knowledge"],
    },
    {
        id: "daily-posts",
        name: "Daily Posts",
        description: "Draft daily social media posts from content calendar",
        cron: "0 13 * * *",
        cronDescription: "Daily at 1:00 PM UTC",
        requiredPlugins: ["postiz", "convex-knowledge"],
    },
    {
        id: "newsletter-writer",
        name: "Newsletter Writer",
        description: "Weekly newsletter draft from content calendar and engagement data",
        cron: "0 14 * * 2",
        cronDescription: "Tuesdays at 2:00 PM UTC",
        requiredPlugins: ["beehiiv", "convex-knowledge"],
    },
    {
        id: "engagement-monitor",
        name: "Engagement Monitor",
        description: "Weekly social media analytics and performance insights",
        cron: "0 18 * * 5",
        cronDescription: "Fridays at 6:00 PM UTC",
        requiredPlugins: ["postiz", "convex-knowledge"],
    },
    {
        id: "job-hunter",
        name: "Job Hunter",
        description: "On-demand job search, company research, and outreach drafting",
        cron: null,
        cronDescription: "On-demand only",
        requiredPlugins: [],
    },
];
export function getSkillById(id) {
    return SKILL_REGISTRY.find((s) => s.id === id);
}
//# sourceMappingURL=skills.js.map