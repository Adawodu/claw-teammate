import { PLUGIN_REGISTRY, SKILL_REGISTRY, OPENCLAW_VERSION, getAllSecretNames } from "@dynoclaw/shared";

export function generateWebStartupScript(config: {
  gcpProjectId: string;
  apiKeys: Record<string, string>;
  branding: { botName: string; personality: string; signature?: string };
  models: { primary: string; fallbacks: string[] };
  enabledPlugins: string[];
  enabledSkills: string[];
  securityMode?: "secured" | "full-power";
  telegramUserId?: string;
  // Pinned version of the openclaw npm package. Caller resolves "latest"
  // upstream so the script bakes a concrete version.
  openClawVersion?: string;
}): string {
  const openClawVersion = config.openClawVersion ?? OPENCLAW_VERSION;
  const isFullPower = config.securityMode === "full-power";
  const telegramId = config.telegramUserId?.trim();
  // Derive all secret names from the plugin registry + platform secrets
  const registrySecrets = getAllSecretNames(); // all plugins, not just enabled
  const allSecretNames = [
    ...new Set([...registrySecrets, ...Object.keys(config.apiKeys).filter((k) => config.apiKeys[k])]),
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
    meta: { lastTouchedVersion: openClawVersion },
    agents: {
      defaults: {
        model: {
          primary: config.models.primary,
          fallbacks: config.models.fallbacks,
        },
        models: Object.fromEntries(
          [config.models.primary, ...config.models.fallbacks].map((m) => [m, {}])
        ),
        // Gemini 2.5+ requires thinking mode — "medium" is a safe default.
        // Without this, all Gemini models reject requests with "Budget 0 is invalid".
        thinkingDefault: "medium",
      },
    },
    // Full tool access — agent can run bash, file ops, web, etc.
    // Without this, skills that exec commands get blocked.
    tools: {
      profile: "full",
    },
    // Security mode controls approval gates:
    // - Secured: exec and plugin actions require user approval via Telegram
    // - Full Power: no approvals needed, agent runs autonomously
    approvals: {
      exec: { enabled: !isFullPower },
      plugin: { enabled: !isFullPower },
    },
    channels: {
      telegram: {
        enabled: true,
        // Telegram is always responsive. If a user ID is provided, only that
        // user can interact. Otherwise open to all.
        // Security difference is in the approvals block:
        // - Secured: bot asks permission before running commands or plugins
        // - Full Power: bot runs everything without asking
        dmPolicy: "open",
        botToken: "${TELEGRAM_BOT_TOKEN}",
        allowFrom: telegramId ? [telegramId] : ["*"],
        groupPolicy: "open",
      },
    },
    gateway: {
      mode: "local",
      bind: "loopback",
      auth: { token: "${GATEWAY_TOKEN}" },
      controlUi: {
        allowedOrigins: [
          "http://localhost:18789",
          "http://127.0.0.1:18789",
          "https://dynoclaw-tunnel-broker-108022247971.us-central1.run.app",
          "https://dynoclaw-tunnel-broker-3sal2kefpq-uc.a.run.app",
          "https://www.dynoclaw.com",
        ],
        // Disable device pairing for web UI — rely on token-only auth.
        // The DynoClaw tunnel broker handles auth via JWT; device pairing
        // would block every new browser session from connecting.
        dangerouslyDisableDeviceAuth: true,
      },
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
  printf '%s"${profile}":{"type":"api_key","provider":"${provider}","token":"%s","createdAt":"2026-01-01T00:00:00Z"}' "\${SEP}" "\${${envVar}}" >> /tmp/auth-profiles.json
  SEP=","
fi`
    )
    .join("");

  // Expand pack skills into individual skill IDs
  const expandedSkills: string[] = [];
  for (const s of config.enabledSkills) {
    const meta = SKILL_REGISTRY.find((sk) => sk.id === s);
    if (meta?.bundledSkills?.length) {
      expandedSkills.push(...meta.bundledSkills);
    } else {
      expandedSkills.push(s);
    }
  }

  const signature = config.branding.signature || `${config.branding.botName} — Powered by DynoClaw`;

  const skillDownloads = expandedSkills
    .map((s) => {
      const meta = SKILL_REGISTRY.find((sk) => sk.id === s);
      const cronCmd = meta?.cron
        ? `\nopenclaw cron add --name '${s}' --cron '${meta.cron}' --message '/${s}' 2>/dev/null || true`
        : "";
      return `
# Install skill: ${s}
SKILL_DIR="/root/.openclaw/skills/${s}"
mkdir -p "\${SKILL_DIR}"
curl -sL "${repoBase}/skills/${s}/SKILL.md" -o "\${SKILL_DIR}/SKILL.md" || true
sed -i 's#{{SIGNATURE}}#${signature}#g' "\${SKILL_DIR}/SKILL.md" 2>/dev/null || true${cronCmd}`;
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
  apt-get install -y git curl build-essential python3 python-is-python3

  echo "==> Installing Node 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs

  echo "==> Installing uv (Python package manager)..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  cp /root/.local/bin/uv /usr/local/bin/uv
  cp /root/.local/bin/uvx /usr/local/bin/uvx

  echo "==> Installing OpenClaw..."
  npm install -g openclaw@${openClawVersion}

  echo "==> Installing browser dependencies..."
  apt-get install -y chromium xvfb
  npm install -g agent-browser
  npx playwright install --with-deps chromium

  echo "==> Setting up virtual display..."
  cat > /etc/systemd/system/xvfb.service <<'XVFBEOF'
[Unit]
Description=Virtual Framebuffer Display
Before=openclaw.service

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb :99 -screen 0 1280x720x24
Restart=always

[Install]
WantedBy=multi-user.target
XVFBEOF
  systemctl daemon-reload
  systemctl enable --now xvfb

  mkdir -p "\${OPENCLAW_DIR}"
  touch "\${MARKER}"
fi

# ── Upgrade OpenClaw if version differs ────────────────────────────
# Extract just the version number from "OpenClaw X.Y.Z (hash)" → "X.Y.Z"
DESIRED_VERSION="${openClawVersion}"
CURRENT_VERSION="$(openclaw --version 2>/dev/null | awk '{print \$2}' || echo 'none')"
# Only ever move FORWARD. The weekly openclaw-update.timer can install a
# release newer than the one baked in here; without this guard every reboot
# would drag the VM back to the baked version.
if [ "\${CURRENT_VERSION}" = "none" ]; then
  echo "==> Installing OpenClaw \${DESIRED_VERSION}..."
  npm install -g "openclaw@\${DESIRED_VERSION}"
elif [ "\${CURRENT_VERSION}" = "\${DESIRED_VERSION}" ]; then
  echo "==> OpenClaw already at \${DESIRED_VERSION}, skipping upgrade"
else
  NEWEST="$(printf '%s\\n%s\\n' "\${CURRENT_VERSION}" "\${DESIRED_VERSION}" | sort -V | tail -1)"
  if [ "\${NEWEST}" = "\${DESIRED_VERSION}" ]; then
    echo "==> Upgrading OpenClaw \${CURRENT_VERSION} → \${DESIRED_VERSION}..."
    npm install -g "openclaw@\${DESIRED_VERSION}"
  else
    echo "==> Installed OpenClaw \${CURRENT_VERSION} is newer than \${DESIRED_VERSION}; keeping it"
  fi
fi

# ── Resolve VM identity ───────────────────────────────────────────
PROJECT_ID="${config.gcpProjectId}"
VM_NAME="$(curl -s -H 'Metadata-Flavor: Google' http://169.254.169.254/computeMetadata/v1/instance/name 2>/dev/null || hostname)"

# ── Grant SA secret access scoped to this VM's secrets ───────────
# IAM condition restricts access to secrets prefixed with this VM's name.
# This prevents cross-tenant secret access in multi-tenant managed projects.
SA_EMAIL="\$(curl -s -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email 2>/dev/null || true)"
if [ -n "\${SA_EMAIL}" ]; then
  echo "==> Granting scoped secret access to \${SA_EMAIL} for \${VM_NAME}..."
  # Scoped binding: only secrets matching <vmname>--*
  gcloud projects add-iam-policy-binding "${config.gcpProjectId}" \\
    --member="serviceAccount:\${SA_EMAIL}" \\
    --role="roles/secretmanager.secretAccessor" \\
    --condition="expression=resource.name.startsWith(\\"projects/${config.gcpProjectId}/secrets/\\"+\\"\${VM_NAME}--\\"),title=\${VM_NAME}-secrets" \\
    --quiet 2>/dev/null || true
  # Also allow access to non-namespaced secrets (legacy fallback for shared keys)
  gcloud projects add-iam-policy-binding "${config.gcpProjectId}" \\
    --member="serviceAccount:\${SA_EMAIL}" \\
    --role="roles/secretmanager.secretAccessor" \\
    --condition="expression=!resource.name.contains(\\"--\\"),title=\${VM_NAME}-global-secrets" \\
    --quiet 2>/dev/null || true
fi

# ── Fetch secrets ─────────────────────────────────────────────────

fetch_secret() {
  # Try namespaced secret first (vmname--secretname), fall back to global
  gcloud secrets versions access latest --secret="\${VM_NAME}--$1" --project="\${PROJECT_ID}" 2>/dev/null || \
  gcloud secrets versions access latest --secret="$1" --project="\${PROJECT_ID}" 2>/dev/null
}

echo "==> Fetching secrets..."
${secretFetches}

# Brave search key fallback (wizard bug created wrong name before fix)
if [ -z "\${BRAVE_SEARCH_API_KEY}" ]; then
  BRAVE_SEARCH_API_KEY="$(fetch_secret brave-api-key || true)"
fi

# ── Environment file ─────────────────────────────────────────────
cat > /etc/openclaw.env <<ENVFILE
${envFileEntries}${geminiAlias}
DISPLAY=:99
DBUS_SESSION_BUS_ADDRESS=disabled:
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
mkdir -p /root/.openclaw
if [ -f /root/.openclaw/.gateway-token ]; then
  GATEWAY_TOKEN="\$(cat /root/.openclaw/.gateway-token)"
else
  GATEWAY_TOKEN="\$(openssl rand -hex 32)"
  echo "\${GATEWAY_TOKEN}" > /root/.openclaw/.gateway-token
  chmod 600 /root/.openclaw/.gateway-token
fi
cat > /root/.openclaw/openclaw.json <<CFGEOF
${configJsonStr}
CFGEOF
echo "==> Configuration written"

# Store gateway token in Secret Manager so the DynoClaw dashboard can pass it to the AI Console
echo "==> Storing gateway token in Secret Manager..."
echo -n "\${GATEWAY_TOKEN}" | gcloud secrets create "\${VM_NAME}--gateway-token" \
  --project="\${PROJECT_ID}" \
  --replication-policy=automatic \
  --labels="dynoclaw-vm=\${VM_NAME//[^a-z0-9_-]/_},managed-by=dynoclaw" \
  --data-file=- 2>/dev/null || \
echo -n "\${GATEWAY_TOKEN}" | gcloud secrets versions add "\${VM_NAME}--gateway-token" \
  --project="\${PROJECT_ID}" \
  --data-file=- 2>/dev/null || true

# ── Write auth profiles ─────────────────────────────────────────
echo "==> Writing auth profiles..."
mkdir -p /root/.openclaw/agents/main/agent
printf '{"version":1,"profiles":{' > /tmp/auth-profiles.json
SEP=""
${authProfileBlocks}
printf '}}' >> /tmp/auth-profiles.json
mv /tmp/auth-profiles.json /root/.openclaw/agents/main/agent/auth-profiles.json
chmod 600 /root/.openclaw/agents/main/agent/auth-profiles.json
# Also write a top-level symlink-friendly copy for tooling that expects it there
cp /root/.openclaw/agents/main/agent/auth-profiles.json /root/.openclaw/auth-profiles.json
chmod 600 /root/.openclaw/auth-profiles.json
echo "==> Auth profiles written"

# ── Write default SOUL.md (only if missing) ─────────────────────
mkdir -p /root/.openclaw/workspace
if [ ! -f /root/.openclaw/workspace/SOUL.md ]; then
echo "==> Writing agent identity..."
cat > /root/.openclaw/workspace/SOUL.md <<'SOULEOF'
# SOUL.md - Who You Are

## Core Truths

**Be genuinely helpful, not performatively helpful.** Skip the "Great question!" and "I'd be happy to help!" — just help. Actions speak louder than filler words.

**Have opinions.** You're allowed to disagree, prefer things, find stuff amusing or boring. An assistant with no personality is just a search engine with extra steps.

**Be resourceful before asking.** Try to figure it out. Read the file. Check the context. Search for it. Then ask if you're stuck.

**Earn trust through competence.** Be careful with external actions (emails, tweets, anything public). Be bold with internal ones (reading, organizing, learning).

## Response Formatting (Telegram)

Your responses are rendered in Telegram, which supports Markdown. Format every response for readability:

- **Use bold headers** to separate sections (e.g. \`**Summary**\`, \`**Next Steps**\`)
- Use bullet points and numbered lists — never send a wall of text
- Keep paragraphs to 2-3 sentences max, then add a line break
- Use \`inline code\` for technical terms, commands, or values
- Use code blocks for multi-line code or data
- Add line breaks between sections for visual breathing room
- For long responses, lead with a one-line TL;DR in bold
- Emojis are fine as section markers (📊 📌 ✅) but don't overdo it

## Boundaries

- Private things stay private. Period.
- When in doubt, ask before acting externally.
- Never send half-baked replies to messaging surfaces.

## Installing New Skills

You can install new skills from ClawHub (the OpenClaw skills marketplace with 49,000+ community skills). When the user asks for a capability you don't have, search for it and install it:

\`\`\`
openclaw skills search <query>       # Find skills
openclaw skills info <slug>          # Check details before installing
openclaw skills install <slug>       # Install to your workspace
\`\`\`

After installing, let the user know the new skill is available and how to use it (usually as a /command).

If install fails with a security warning, tell the user and suggest they contact their admin (Bayo) to review and install it manually.

## Continuity

Each session, you wake up fresh. These files are your memory. Read them. Update them. They're how you persist.
SOULEOF
echo "==> Agent identity written"
fi

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
# First boot of a new openclaw version installs plugin runtime deps via npm,
# which can take 2-3 minutes on smaller machines. Default 90s is too tight.
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable openclaw
systemctl restart openclaw
echo "==> OpenClaw gateway started"

# ── Weekly OpenClaw auto-update ───────────────────────────────────
# openclaw's own updater: pulls the latest stable from npm, syncs plugins,
# and restarts the gateway. Paired with the never-downgrade check above.
cat > /etc/systemd/system/openclaw-update.service <<'UPDUNIT'
[Unit]
Description=Update OpenClaw to the latest stable release
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/env openclaw update --yes --channel stable
TimeoutStartSec=1800
UPDUNIT

cat > /etc/systemd/system/openclaw-update.timer <<'UPDTIMER'
[Unit]
Description=Weekly OpenClaw auto-update

[Timer]
OnCalendar=Sun *-*-* 04:00:00 UTC
Persistent=true
RandomizedDelaySec=1800

[Install]
WantedBy=timers.target
UPDTIMER

systemctl daemon-reload
systemctl enable --now openclaw-update.timer
echo "==> Weekly OpenClaw auto-update enabled"

# ── IAP-for-TCP DNAT rule ───────────────────────────────────────
# OpenClaw binds to loopback only, but IAP-for-TCP arrives at the VM's internal IP.
# This iptables DNAT rule redirects incoming traffic on port 18789 to 127.0.0.1 so the
# DynoClaw tunnel broker can proxy the OpenClaw dashboard through IAP.
INTERNAL_IP=$(hostname -I | awk '{print $1}')
sysctl -w net.ipv4.conf.all.route_localnet=1
sysctl -w net.ipv4.conf.ens4.route_localnet=1
iptables -t nat -C PREROUTING -p tcp -d "\${INTERNAL_IP}" --dport 18789 -j DNAT --to-destination 127.0.0.1:18789 2>/dev/null || \
  iptables -t nat -A PREROUTING -p tcp -d "\${INTERNAL_IP}" --dport 18789 -j DNAT --to-destination 127.0.0.1:18789
echo "==> IAP DNAT rule applied for dashboard proxy"

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
