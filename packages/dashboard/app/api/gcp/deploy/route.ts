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
import { SKILL_REGISTRY, PLUGIN_REGISTRY } from "@dynoclaw/shared";

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
      gcpProjectId,
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

// Known secrets that may exist in Secret Manager.
// The startup script always tries to fetch all of them, so re-deploys and
// reboots work even if the user didn't re-enter keys in the wizard.
const KNOWN_SECRETS = [
  "telegram-bot-token",
  "google-ai-api-key",
  "openai-api-key",
  "openrouter-api-key",
  "anthropic-api-key",
  "postiz-api-key",
  "postiz-url",
  "convex-url",
  "beehiiv-api-key",
  "beehiiv-publication-id",
  "twitter-bearer-token",
  "brave-search-api-key",
  "drive-oauth-client-id",
  "drive-oauth-client-secret",
  "drive-oauth-refresh-token",
  "drive-media-folder-id",
];

function generateWebStartupScript(config: {
  gcpProjectId: string;
  apiKeys: Record<string, string>;
  branding: { botName: string; personality: string };
  models: { primary: string; fallbacks: string[] };
  enabledPlugins: string[];
  enabledSkills: string[];
}): string {
  // Build the union of known secrets + any user-provided keys
  const allSecretNames = [
    ...new Set([...KNOWN_SECRETS, ...Object.keys(config.apiKeys).filter((k) => config.apiKeys[k])]),
  ];

  const secretFetches = allSecretNames
    .map((secretName) => {
      const envVar = secretName.toUpperCase().replace(/-/g, "_");
      return `${envVar}="$(fetch_secret ${secretName} || true)"`;
    })
    .join("\n");

  const envFileEntries = allSecretNames
    .map((secretName) => {
      const envVar = secretName.toUpperCase().replace(/-/g, "_");
      return `${envVar}=\${${envVar}}`;
    })
    .join("\n");

  const geminiAlias = "\nGEMINI_API_KEY=${GOOGLE_AI_API_KEY}";

  const repoBase = "https://raw.githubusercontent.com/Adawodu/dynoclaw/main";

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

  // Build the full plugin entries JSON with ${BASH_VAR} placeholders for secrets
  const pluginEntries: Record<string, { enabled: boolean; config: Record<string, string> }> = {};
  for (const p of config.enabledPlugins) {
    const meta = PLUGIN_REGISTRY.find((pm) => pm.id === p);
    if (!meta) continue;
    const pluginCfg: Record<string, string> = {};
    for (const k of [...meta.requiredKeys, ...meta.optionalKeys]) {
      const envVar = k.secretName.toUpperCase().replace(/-/g, "_");
      pluginCfg[k.key] = `\${${envVar}}`;
    }
    pluginEntries[p] = { enabled: true, config: pluginCfg };
  }

  // Build the complete openclaw.json as a JSON string with bash ${VAR} placeholders.
  // The heredoc (without quotes) will expand these at runtime.
  const fullConfig = {
    meta: { lastTouchedVersion: "2026.2.17" },
    agents: {
      defaults: {
        model: {
          primary: config.models.primary,
          fallbacks: config.models.fallbacks,
        },
        models: Object.fromEntries(
          [config.models.primary, ...config.models.fallbacks].map((m) => [m, {}])
        ),
      },
    },
    channels: {
      telegram: {
        enabled: true,
        dmPolicy: "open",
        botToken: "${TELEGRAM_BOT_TOKEN}",
        allowFrom: ["*"],
        groupPolicy: "open",
      },
    },
    gateway: {
      mode: "local",
      bind: "loopback",
      auth: { token: "${GATEWAY_TOKEN}" },
    },
    plugins: {
      allow: config.enabledPlugins,
      entries: pluginEntries,
    },
  };
  // Stringify and unescape the bash variable placeholders.
  // JSON.stringify wraps ${VAR} in quotes → "${VAR}" which is correct for heredoc expansion.
  const configJsonStr = JSON.stringify(fullConfig, null, 2);

  // Auth profile entries for the heredoc builder
  const authProviders = [
    { profile: "google:manual", provider: "google", envVar: "GOOGLE_AI_API_KEY" },
    { profile: "anthropic:manual", provider: "anthropic", envVar: "ANTHROPIC_API_KEY" },
    { profile: "openai:manual", provider: "openai", envVar: "OPENAI_API_KEY" },
    { profile: "openrouter:manual", provider: "openrouter", envVar: "OPENROUTER_API_KEY" },
  ];
  const authProfileBlocks = authProviders
    .map(
      ({ profile, provider, envVar }) => `
if [ -n "\${${envVar}:-}" ]; then
  printf '%s"${profile}":{"provider":"${provider}","token":"%s","createdAt":"2026-01-01T00:00:00Z"}' "\${SEP}" "\${${envVar}}" >> /tmp/auth-profiles.json
  SEP=","
fi`
    )
    .join("");

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
  npm install -g openclaw@2026.2.17

  mkdir -p "\${OPENCLAW_DIR}"
  touch "\${MARKER}"
fi

# ── Fetch secrets ─────────────────────────────────────────────────
PROJECT_ID="${config.gcpProjectId}"

fetch_secret() {
  gcloud secrets versions access latest --secret="$1" --project="\${PROJECT_ID}" 2>/dev/null
}

echo "==> Fetching secrets..."
${secretFetches}

# ── Environment file ─────────────────────────────────────────────
cat > /etc/openclaw.env <<ENVFILE
${envFileEntries}${geminiAlias}
ENVFILE
chmod 600 /etc/openclaw.env

# ── Install plugins ──────────────────────────────────────────────
echo "==> Installing plugins..."
${pluginDownloads}

# ── Install skills ───────────────────────────────────────────────
echo "==> Installing skills..."
${skillDownloads}

# ── Write full openclaw.json (heredoc with bash var expansion) ───
echo "==> Writing OpenClaw configuration..."
GATEWAY_TOKEN="\$(openssl rand -hex 32)"
mkdir -p /root/.openclaw
cat > /root/.openclaw/openclaw.json <<CFGEOF
${configJsonStr}
CFGEOF
echo "==> Configuration written"

# ── Write auth profiles ─────────────────────────────────────────
echo "==> Writing auth profiles..."
mkdir -p /root/.openclaw/agents/main/agent
printf '{"version":1,"profiles":{' > /tmp/auth-profiles.json
SEP=""
${authProfileBlocks}
printf '}}' >> /tmp/auth-profiles.json
mv /tmp/auth-profiles.json /root/.openclaw/agents/main/agent/auth-profiles.json
echo "==> Auth profiles written"

# ── Systemd unit ─────────────────────────────────────────────────
cat > /etc/systemd/system/openclaw.service <<UNIT
[Unit]
Description=OpenClaw Gateway — ${config.branding.botName}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/openclaw.env
ExecStartPre=-/usr/bin/env openclaw security audit
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

# ── First-boot grace restart ────────────────────────────────────
# On first boot the gateway starts under heavy I/O from plugin installs.
# Schedule a one-shot restart after 90s so Telegram polling initializes cleanly.
if [ ! -f "/opt/openclaw/.grace-restarted" ]; then
  echo "==> Scheduling grace restart in 90s (first boot)..."
  (sleep 90 && systemctl restart openclaw && touch /opt/openclaw/.grace-restarted) &
  disown
fi
`;
}

