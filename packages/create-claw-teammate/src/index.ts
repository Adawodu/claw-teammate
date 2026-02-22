#!/usr/bin/env node

import { runWizard } from "./wizard/index.js";

function parseArgs(args: string[]): { preset?: string; dryRun: boolean } {
  let preset: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--preset" && args[i + 1]) {
      preset = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Usage: create-claw-teammate [options]

Options:
  --preset <path|url>  Load a preset configuration (file, URL, or built-in name)
  --dry-run            Show what would be deployed without creating resources
  --help, -h           Show this help message

Examples:
  npx create-claw-teammate
  npx create-claw-teammate --preset social-media-manager
  npx create-claw-teammate --preset ./my-preset.json
  npx create-claw-teammate --dry-run
`);
      process.exit(0);
    }
  }

  return { preset, dryRun };
}

const options = parseArgs(process.argv.slice(2));

runWizard(options).catch((error) => {
  console.error("\nFatal error:", error.message);
  process.exit(1);
});
