import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { getGcpToken } from "@/lib/gcp-auth";
import {
  enableApi,
  getProjectNumber,
  createServiceAccount,
  grantRole,
  createSecret,
  createFirewallRule,
  ensureCloudNat,
  createInstance,
} from "@/lib/gcp-rest";
import { maskApiKey } from "@/lib/formatters";
import { SKILL_REGISTRY, PLUGIN_REGISTRY } from "@claw-teammate/shared";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  const authResult = await getGcpToken();
  if (!authResult) {
    return NextResponse.json(
      {
        error:
          "Google account not connected. Sign in with Google or connect it in your profile to enable GCP deployment.",
      },
      { status: 400 }
    );
  }
  const { gcpToken, convexToken } = authResult;

  const body = await req.json();
  const {
    gcpProjectId,
    gcpZone,
    vmName,
    machineType,
    branding,
    models,
    plugins,
    skills,
    apiKeys,
  } = body;

  try {
    // 1. Enable APIs
    await enableApi(gcpToken, gcpProjectId, "compute.googleapis.com");
    await enableApi(gcpToken, gcpProjectId, "secretmanager.googleapis.com");

    // 2. Service account — grant secret access to both custom SA and default compute SA
    const { email: saEmail } = await createServiceAccount(
      gcpToken,
      gcpProjectId,
      "openclaw-sa",
      "OpenClaw SA"
    );
    await grantRole(
      gcpToken,
      gcpProjectId,
      saEmail,
      "roles/secretmanager.secretAccessor"
    );
    // Also grant to default compute SA in case GCP can't assign the custom one
    const projectNumber = await getProjectNumber(gcpToken, gcpProjectId);
    if (projectNumber) {
      const defaultSa = `${projectNumber}-compute@developer.gserviceaccount.com`;
      await grantRole(
        gcpToken,
        gcpProjectId,
        defaultSa,
        "roles/secretmanager.secretAccessor"
      );
    }

    // 3. Store secrets
    for (const [secretName, value] of Object.entries(apiKeys)) {
      if (value) {
        await createSecret(gcpToken, gcpProjectId, secretName, value as string);
      }
    }

    // 4. Firewall rules
    await createFirewallRule(gcpToken, gcpProjectId, {
      name: "allow-iap-ssh",
      direction: "INGRESS",
      priority: 1000,
      allowed: [{ IPProtocol: "tcp", ports: ["22"] }],
      sourceRanges: ["35.235.240.0/20"],
      targetTags: ["openclaw"],
    });
    await createFirewallRule(gcpToken, gcpProjectId, {
      name: "deny-all-ingress",
      direction: "INGRESS",
      priority: 2000,
      denied: [{ IPProtocol: "all" }],
      sourceRanges: ["0.0.0.0/0"],
      targetTags: ["openclaw"],
    });

    // 5. Cloud NAT (allows VM without external IP to reach internet)
    const gcpRegion = gcpZone.replace(/-[a-z]$/, "");
    await ensureCloudNat(gcpToken, gcpProjectId, gcpRegion);

    // 6. Generate startup script with plugin download
    const enabledPlugins = Object.entries(plugins)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const enabledSkills = Object.entries(skills)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const startupScript = generateWebStartupScript({
      apiKeys,
      branding,
      models,
      enabledPlugins,
      enabledSkills,
    });

    // 7. Create VM
    const vmResult = await createInstance(gcpToken, gcpProjectId, gcpZone, {
      name: vmName,
      machineType,
      serviceAccountEmail: saEmail,
      startupScript,
    });

    // 8. Save deployment record to Convex
    let convexWarning: string | undefined;

    if (!convexToken) {
      convexWarning =
        "Could not get Convex auth token. Make sure the 'convex' JWT template exists in Clerk. Dashboard data will not appear until this is fixed.";
      console.warn(convexWarning);
    }

    if (convexToken) {
      convex.setAuth(convexToken);

      try {
        const deploymentId = await convex.mutation(api.deployments.create, {
          gcpProjectId,
          gcpZone,
          vmName,
          machineType,
          branding: {
            botName: branding.botName,
            personality: branding.personality,
          },
          models: {
            primary: models.primary,
            fallbacks: models.fallbacks,
          },
        });

        // Register API keys in Convex
        for (const [secretName, value] of Object.entries(apiKeys)) {
          if (value) {
            await convex.mutation(api.apiKeyRegistry.register, {
              deploymentId,
              secretName,
              maskedValue: maskApiKey(value as string),
            });
          }
        }

        // Save plugin configs
        for (const [pluginId, enabled] of Object.entries(plugins)) {
          await convex.mutation(api.pluginConfigs.set, {
            deploymentId,
            pluginId,
            enabled: enabled as boolean,
          });
        }

        // Save skill configs
        for (const [skillId, enabled] of Object.entries(skills)) {
          await convex.mutation(api.skillConfigs.set, {
            deploymentId,
              skillId,
            enabled: enabled as boolean,
          });
        }
      } catch (convexErr) {
        const msg =
          convexErr instanceof Error ? convexErr.message : String(convexErr);
        convexWarning = `VM created but failed to save to dashboard: ${msg}`;
        console.error("Failed to save deployment to Convex:", convexErr);
      }
    }

    return NextResponse.json({
      success: true,
      vmStatus: vmResult,
      ...(convexWarning && { warning: convexWarning }),
    });
  } catch (error: unknown) {
    console.error("Deploy error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateWebStartupScript(config: {
  apiKeys: Record<string, string>;
  branding: { botName: string; personality: string };
  models: { primary: string; fallbacks: string[] };
  enabledPlugins: string[];
  enabledSkills: string[];
}): string {
  const secretFetches = Object.keys(config.apiKeys)
    .filter((k) => config.apiKeys[k])
    .map((secretName) => {
      const envVar = secretName.toUpperCase().replace(/-/g, "_");
      return `${envVar}="$(fetch_secret ${secretName})"`;
    })
    .join("\n");

  const envFileEntries = Object.keys(config.apiKeys)
    .filter((k) => config.apiKeys[k])
    .map((secretName) => {
      const envVar = secretName.toUpperCase().replace(/-/g, "_");
      return `${envVar}=\${${envVar}}`;
    })
    .join("\n");

  const geminiAlias = config.apiKeys["google-ai-api-key"]
    ? "\nGEMINI_API_KEY=${GOOGLE_AI_API_KEY}"
    : "";

  const repoBase = "https://raw.githubusercontent.com/adawodu/claw-teammate/main";

  const pluginDownloads = config.enabledPlugins
    .map(
      (p) => `
# Install plugin: ${p}
DEST="/root/.openclaw/extensions/${p}"
mkdir -p "\${DEST}"
curl -sfL "${repoBase}/plugins/${p}/package.json" -o "\${DEST}/package.json" 2>/dev/null || rm -f "\${DEST}/package.json"
curl -sfL "${repoBase}/plugins/${p}/index.ts" -o "\${DEST}/index.ts" 2>/dev/null || rm -f "\${DEST}/index.ts"
curl -sfL "${repoBase}/plugins/${p}/openclaw.plugin.json" -o "\${DEST}/openclaw.plugin.json" 2>/dev/null || rm -f "\${DEST}/openclaw.plugin.json"
# Remove plugin dir if manifest is missing (download failed)
[ -f "\${DEST}/openclaw.plugin.json" ] && cd "\${DEST}" && npm install --omit=dev 2>/dev/null || rm -rf "\${DEST}"`
    )
    .join("\n");

  const pluginConfigs = config.enabledPlugins
    .map((p) => {
      const meta = PLUGIN_REGISTRY.find((pm) => pm.id === p);
      if (!meta) return `# Plugin ${p}: no registry entry found`;
      const lines = [
        `openclaw config set plugins.entries.${p}.enabled true 2>/dev/null || true`,
      ];
      for (const k of [...meta.requiredKeys, ...meta.optionalKeys]) {
        lines.push(
          `openclaw config set plugins.entries.${p}.config.${k.key} "$(fetch_secret ${k.secretName})" 2>/dev/null || true`
        );
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const skillDownloads = config.enabledSkills
    .map((s) => {
      const meta = SKILL_REGISTRY.find((sk) => sk.id === s);
      const cronCmd = meta?.cron
        ? `\nopenclaw cron add --name '${s}' --cron '${meta.cron}' --message '/${s}' 2>/dev/null || true`
        : "";
      return `
# Install skill: ${s}
SKILL_DIR="/root/.openclaw/skills/${s}"
mkdir -p "\${SKILL_DIR}"
curl -sL "${repoBase}/skills/${s}/SKILL.md" -o "\${SKILL_DIR}/SKILL.md" || true${cronCmd}`;
    })
    .join("\n");

  const fallbackSetup = config.models.fallbacks
    .map((model) => {
      const envPrefix = getModelEnvPrefix(model);
      return `${envPrefix} openclaw models fallbacks add ${model}`;
    })
    .join("\n");

  return `#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_DIR="/opt/openclaw"
MARKER="/opt/openclaw/.installed"

# ── Install Node 22 + OpenClaw (first boot only) ──────────────────
if [ ! -f "\${MARKER}" ]; then
  echo "==> Installing dependencies..."
  apt-get update -y
  apt-get install -y git curl build-essential python3

  echo "==> Installing Node 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs

  echo "==> Installing OpenClaw..."
  npm install -g openclaw@latest

  mkdir -p "\${OPENCLAW_DIR}"
  touch "\${MARKER}"
fi

# ── Fetch secrets ─────────────────────────────────────────────────
fetch_secret() {
  gcloud secrets versions access latest --secret="$1" 2>/dev/null
}

echo "==> Fetching secrets..."
${secretFetches}

# ── Configure OpenClaw ────────────────────────────────────────────
echo "==> Configuring OpenClaw..."
openclaw config set gateway.bind loopback
openclaw config set gateway.mode local
openclaw config set channels.telegram.enabled true
openclaw config set channels.telegram.botToken "\${TELEGRAM_BOT_TOKEN}" > /dev/null 2>&1
openclaw config set channels.telegram.allowFrom '["*"]'
openclaw config set channels.telegram.dmPolicy open
openclaw config set channels.telegram.groupPolicy disabled

GOOGLE_AI_API_KEY="\${GOOGLE_AI_API_KEY:-}" openclaw models set ${config.models.primary}
openclaw models fallbacks clear
${fallbackSetup}

EXISTING_TOKEN="$(openclaw config get gateway.auth.token 2>/dev/null || true)"
if [ -z "\${EXISTING_TOKEN}" ] || echo "\${EXISTING_TOKEN}" | grep -q "not found"; then
  GATEWAY_TOKEN="$(openssl rand -hex 32)"
  openclaw config set gateway.auth.token "\${GATEWAY_TOKEN}" > /dev/null 2>&1
fi

# ── Auth profiles (model API keys) ──────────────────────────────
echo "==> Setting up auth profiles..."
mkdir -p /root/.openclaw/agents/main/agent
AUTH_JSON="{"
[ -n "\${GOOGLE_AI_API_KEY:-}" ] && AUTH_JSON="\${AUTH_JSON}\"google:manual\":{\"apiKey\":\"\${GOOGLE_AI_API_KEY}\"},"
[ -n "\${ANTHROPIC_API_KEY:-}" ] && AUTH_JSON="\${AUTH_JSON}\"anthropic:manual\":{\"apiKey\":\"\${ANTHROPIC_API_KEY}\"},"
[ -n "\${OPENAI_API_KEY:-}" ] && AUTH_JSON="\${AUTH_JSON}\"openai:manual\":{\"apiKey\":\"\${OPENAI_API_KEY}\"},"
[ -n "\${OPENROUTER_API_KEY:-}" ] && AUTH_JSON="\${AUTH_JSON}\"openrouter:manual\":{\"apiKey\":\"\${OPENROUTER_API_KEY}\"},"
# Remove trailing comma and close
AUTH_JSON="\$(echo "\${AUTH_JSON}" | sed 's/,\$//')}"
echo "\${AUTH_JSON}" > /root/.openclaw/agents/main/agent/auth-profiles.json

# ── Environment file ─────────────────────────────────────────────
cat > /etc/openclaw.env <<ENVFILE
${envFileEntries}${geminiAlias}
ENVFILE
chmod 600 /etc/openclaw.env

# ── Install plugins ──────────────────────────────────────────────
echo "==> Installing plugins..."
${pluginDownloads}

# ── Configure plugins ────────────────────────────────────────────
echo "==> Configuring plugins..."
${pluginConfigs}

# ── Install skills ───────────────────────────────────────────────
echo "==> Installing skills..."
${skillDownloads}

# ── Plugin allowlist ─────────────────────────────────────────────
echo "==> Setting plugin allowlist..."
openclaw config set plugins.allow '${JSON.stringify(config.enabledPlugins)}' 2>/dev/null || true

# ── Systemd unit ─────────────────────────────────────────────────
cat > /etc/systemd/system/openclaw.service <<UNIT
[Unit]
Description=OpenClaw Gateway — ${config.branding.botName}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/openclaw.env
ExecStartPre=-/usr/bin/env openclaw security audit --fix
ExecStart=/usr/bin/env openclaw gateway run --bind loopback
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable openclaw
systemctl restart openclaw
echo "==> OpenClaw gateway started"
`;
}

function getModelEnvPrefix(model: string): string {
  if (model.startsWith("anthropic/")) return 'ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"';
  if (model.startsWith("openai/")) return 'OPENAI_API_KEY="${OPENAI_API_KEY:-}"';
  if (model.startsWith("google/")) return 'GOOGLE_AI_API_KEY="${GOOGLE_AI_API_KEY:-}"';
  return "";
}
