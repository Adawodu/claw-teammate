// Copies plugin and skill source files into the package for distribution.
// Run as prebuild step.

import { cpSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const repoRoot = join(pkgRoot, "..", "..");

const PLUGINS = [
  "postiz",
  "convex-knowledge",
  "beehiiv",
  "image-gen",
  "video-gen",
];

const SKILLS = [
  "daily-briefing",
  "job-hunter",
  "content-engine",
  "daily-posts",
  "newsletter-writer",
  "engagement-monitor",
];

// Copy plugin files
for (const plugin of PLUGINS) {
  const src = join(repoRoot, "plugins", plugin);
  const dest = join(pkgRoot, "plugin-files", plugin);
  mkdirSync(dest, { recursive: true });
  for (const file of ["package.json", "index.ts", "openclaw.plugin.json"]) {
    try {
      cpSync(join(src, file), join(dest, file));
    } catch {
      // Skip missing files
    }
  }
}

// Copy skill files
for (const skill of SKILLS) {
  const src = join(repoRoot, "skills", skill);
  const dest = join(pkgRoot, "skill-files", skill);
  mkdirSync(dest, { recursive: true });
  try {
    cpSync(join(src, "SKILL.md"), join(dest, "SKILL.md"));
  } catch {
    // Skip missing files
  }
}

console.log("Copied plugin and skill files for distribution");
