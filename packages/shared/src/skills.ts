import type { SkillMeta } from "./types";

export const SKILL_REGISTRY: SkillMeta[] = [
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
  {
    id: "dynoclux",
    name: "DynoClux Privacy Enforcement",
    description:
      "Scan inbox, unsubscribe, track CAN-SPAM/CCPA deadlines, detect violations, and draft compliance notices",
    cron: null,
    cronDescription: "On-demand only",
    requiredPlugins: ["dynoclux"],
  },
  {
    id: "dynosist",
    name: "DynoSist Email Assistant",
    description: "Compose Gmail drafts with file attachments via conversational interface",
    cron: null,
    cronDescription: "On-demand only",
    requiredPlugins: ["dynosist"],
  },
];

export function getSkillById(id: string): SkillMeta | undefined {
  return SKILL_REGISTRY.find((s) => s.id === id);
}
