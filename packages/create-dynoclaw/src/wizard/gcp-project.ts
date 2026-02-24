import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { run } from "../utils/shell.js";
import type { GcpConfig } from "../config/types.js";

const GCP_REGIONS = [
  "us-central1",
  "us-east1",
  "us-west1",
  "europe-west1",
  "europe-west4",
  "asia-east1",
  "asia-southeast1",
];

const MACHINE_TYPES = [
  { name: "e2-small (2 vCPU, 2 GB) — ~$7/mo", value: "e2-small" },
  { name: "e2-medium (2 vCPU, 4 GB) — ~$14/mo", value: "e2-medium" },
  { name: "e2-standard-2 (2 vCPU, 8 GB) — ~$28/mo", value: "e2-standard-2" },
];

export async function gcpProjectStep(): Promise<GcpConfig> {
  // Auto-detect current project
  const currentProject = await run("gcloud", [
    "config",
    "get-value",
    "project",
  ]);
  const detectedProject = currentProject.stdout.trim();

  const projectId = await input({
    message: "GCP Project ID:",
    default: detectedProject || undefined,
    validate: (value) => {
      if (!value.trim()) return "Project ID is required";
      if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value.trim())) {
        return "Invalid project ID format";
      }
      return true;
    },
  });

  const region = await select({
    message: "Region:",
    choices: GCP_REGIONS.map((r) => ({ name: r, value: r })),
    default: "us-central1",
  });

  const zone = await input({
    message: "Zone:",
    default: `${region}-a`,
  });

  const machineType = await select({
    message: "Machine type:",
    choices: MACHINE_TYPES,
    default: "e2-small",
  });

  const vmName = await input({
    message: "VM name:",
    default: "openclaw-vm",
    validate: (value) => {
      if (!value.trim()) return "VM name is required";
      return true;
    },
  });

  console.log(
    chalk.dim(`\n  Project: ${projectId} | Zone: ${zone} | Machine: ${machineType}\n`),
  );

  return { projectId, region, zone, machineType, vmName };
}
