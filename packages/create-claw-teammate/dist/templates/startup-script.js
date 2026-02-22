export function generateStartupScript(config) {
    const secretFetches = Object.keys(config.apiKeys)
        .map((secretName) => {
        const envVar = secretNameToEnvVar(secretName);
        const isRequired = [
            "telegram-bot-token",
            "google-ai-api-key",
            "anthropic-api-key",
        ].includes(secretName);
        const fallback = isRequired ? "" : " || true";
        return `${envVar}="$(fetch_secret ${secretName}${fallback})"`;
    })
        .join("\n");
    const envFileEntries = Object.keys(config.apiKeys)
        .map((secretName) => {
        const envVar = secretNameToEnvVar(secretName);
        return `${envVar}=\${${envVar}}`;
    })
        .join("\n");
    // Add GEMINI_API_KEY alias if google-ai-api-key is present
    const geminiAlias = config.apiKeys["google-ai-api-key"]
        ? "\nGEMINI_API_KEY=${GOOGLE_AI_API_KEY}"
        : "";
    return `#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_DIR="/opt/openclaw"
CONFIG_FILE="\${OPENCLAW_DIR}/config.jsonc"
MARKER="/opt/openclaw/.installed"

# ── Install Node 22 + OpenClaw (first boot only) ──────────────────
if [ ! -f "\${MARKER}" ]; then
  echo "==> Installing dependencies..."
  apt-get update -y
  apt-get install -y git

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

# ── Configure OpenClaw via CLI ────────────────────────────────────
echo "==> Configuring OpenClaw..."
openclaw config set gateway.bind loopback
openclaw config set gateway.mode local
openclaw config set channels.telegram.enabled true
openclaw config set channels.telegram.botToken "\${TELEGRAM_BOT_TOKEN}" > /dev/null 2>&1
openclaw config set channels.telegram.dmPolicy pairing
openclaw config set channels.telegram.groupPolicy disabled

# Model fallback chain
GOOGLE_AI_API_KEY="\${GOOGLE_AI_API_KEY}" openclaw models set ${config.models.primary}
openclaw models fallbacks clear
${config.models.fallbacks
        .map((model, i) => {
        const envPrefix = getModelEnvPrefix(model);
        return `${envPrefix} openclaw models fallbacks add ${model}`;
    })
        .join("\n")}

# Generate a gateway auth token on first run only
EXISTING_TOKEN="$(openclaw config get gateway.auth.token 2>/dev/null || true)"
if [ -z "\${EXISTING_TOKEN}" ] || echo "\${EXISTING_TOKEN}" | grep -q "not found"; then
  GATEWAY_TOKEN="$(openssl rand -hex 32)"
  openclaw config set gateway.auth.token "\${GATEWAY_TOKEN}" > /dev/null 2>&1
fi

# ── Environment file (secrets not visible in unit file) ──────────
cat > /etc/openclaw.env <<ENVFILE
${envFileEntries}${geminiAlias}
ENVFILE
chmod 600 /etc/openclaw.env

# ── Systemd unit ──────────────────────────────────────────────────
cat > /etc/systemd/system/openclaw.service <<UNIT
[Unit]
Description=OpenClaw Gateway — ${config.branding.botName}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/openclaw.env
ExecStartPre=/usr/bin/env openclaw security audit --fix
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
function secretNameToEnvVar(secretName) {
    return secretName.toUpperCase().replace(/-/g, "_");
}
function getModelEnvPrefix(model) {
    if (model.startsWith("anthropic/")) {
        return 'ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"';
    }
    if (model.startsWith("openai/")) {
        return 'OPENAI_API_KEY="${OPENAI_API_KEY}"';
    }
    if (model.startsWith("google/")) {
        return 'GOOGLE_AI_API_KEY="${GOOGLE_AI_API_KEY}"';
    }
    return "";
}
//# sourceMappingURL=startup-script.js.map