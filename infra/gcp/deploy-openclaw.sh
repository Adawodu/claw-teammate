#!/usr/bin/env bash
#
# deploy-openclaw.sh — provision a GCP Compute Engine VM running OpenClaw.
#
# Prerequisites:
#   - gcloud CLI authenticated with appropriate permissions
#   - Secrets already created in Secret Manager:
#       telegram-bot-token, anthropic-api-key, google-ai-api-key,
#       openai-api-key, convex-url, beehiiv-publication-id
#       (gmail-credentials, github-token, github-default-owner, beehiiv-api-key, postiz-url, postiz-api-key, agentmail-api-key as needed)
#
# Usage:
#   GCP_PROJECT=my-project bash infra/gcp/deploy-openclaw.sh
#
set -euo pipefail

PROJECT="${GCP_PROJECT:?Set GCP_PROJECT}"
REGION="${GCP_REGION:-us-central1}"
ZONE="${GCP_ZONE:-us-central1-a}"
VM_NAME="openclaw-vm"
SA_NAME="openclaw-sa"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
MACHINE_TYPE="e2-small"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Project: ${PROJECT}  Region: ${REGION}  Zone: ${ZONE}"

# ── Enable APIs ──────────────────────────────────────────────────────
echo "==> Enabling required APIs..."
gcloud services enable \
  compute.googleapis.com \
  secretmanager.googleapis.com \
  drive.googleapis.com \
  --project="${PROJECT}"

# ── Service account ──────────────────────────────────────────────────
echo "==> Setting up service account..."
if gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}" 2>/dev/null; then
  echo "Service account already exists"
else
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="OpenClaw SA" \
    --project="${PROJECT}"
  # Brief pause to allow IAM propagation after SA creation
  sleep 10
fi

gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

# ── Firewall rules ───────────────────────────────────────────────────
echo "==> Configuring firewall rules..."

# Allow SSH from IAP only
gcloud compute firewall-rules describe allow-iap-ssh \
  --project="${PROJECT}" 2>/dev/null \
|| gcloud compute firewall-rules create allow-iap-ssh \
  --project="${PROJECT}" \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:22 \
  --source-ranges=35.235.240.0/20 \
  --target-tags=openclaw

# Deny all other ingress
gcloud compute firewall-rules describe deny-all-ingress \
  --project="${PROJECT}" 2>/dev/null \
|| gcloud compute firewall-rules create deny-all-ingress \
  --project="${PROJECT}" \
  --direction=INGRESS \
  --priority=2000 \
  --network=default \
  --action=DENY \
  --rules=all \
  --source-ranges=0.0.0.0/0 \
  --target-tags=openclaw

# ── Write startup script to temp file ────────────────────────────────
# Using a file avoids shell escaping issues with --metadata inline
STARTUP_FILE="$(mktemp)"
trap 'rm -f "${STARTUP_FILE}"' EXIT

cat > "${STARTUP_FILE}" << 'STARTUP_EOF'
#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_DIR="/opt/openclaw"
CONFIG_FILE="${OPENCLAW_DIR}/config.jsonc"
MARKER="/opt/openclaw/.installed"

# ── Install Node 22 + OpenClaw (first boot only) ──────────────────
if [ ! -f "${MARKER}" ]; then
  echo "==> Installing dependencies..."
  apt-get update -y
  apt-get install -y git

  echo "==> Installing Node 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs

  echo "==> Installing OpenClaw..."
  npm install -g openclaw@2026.2.26

  mkdir -p "${OPENCLAW_DIR}"
  touch "${MARKER}"
fi

# ── Install Bun + QMD + agent-browser (idempotent) ───────────────────
export BUN_INSTALL="/root/.bun"
export PATH="${BUN_INSTALL}/bin:${PATH}"
if ! command -v bun &>/dev/null; then
  echo "==> Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
fi
if ! command -v qmd &>/dev/null; then
  echo "==> Installing QMD..."
  npm install -g @tobilu/qmd
fi
if ! command -v agent-browser &>/dev/null; then
  echo "==> Installing agent-browser + Playwright Chromium..."
  npm install -g agent-browser
  npx playwright install --with-deps chromium
fi

# ── Upgrade OpenClaw if version differs ────────────────────────────
DESIRED_VERSION="2026.2.26"
CURRENT_VERSION="$(openclaw --version 2>/dev/null || echo 'none')"
if [ "${CURRENT_VERSION}" != "${DESIRED_VERSION}" ]; then
  echo "==> Upgrading OpenClaw ${CURRENT_VERSION} → ${DESIRED_VERSION}..."
  npm install -g "openclaw@${DESIRED_VERSION}"
fi

# ── Fetch secrets ─────────────────────────────────────────────────
PROJECT_ID="$(curl -s -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/project/project-id)"

fetch_secret() {
  gcloud secrets versions access latest --secret="$1" --project="${PROJECT_ID}" 2>/dev/null
}

echo "==> Fetching secrets..."
TELEGRAM_BOT_TOKEN="$(fetch_secret telegram-bot-token)"
ANTHROPIC_API_KEY="$(fetch_secret anthropic-api-key)"
GMAIL_CREDENTIALS="$(fetch_secret gmail-credentials || true)"
GITHUB_TOKEN="$(fetch_secret github-token || true)"
BEEHIIV_API_KEY="$(fetch_secret beehiiv-api-key || true)"
BEEHIIV_PUBLICATION_ID="$(fetch_secret beehiiv-publication-id || true)"
GOOGLE_AI_API_KEY="$(fetch_secret google-ai-api-key)"  # Required — primary model
OPENAI_API_KEY="$(fetch_secret openai-api-key || true)"
CONVEX_URL="$(fetch_secret convex-url || true)"

# ── Configure OpenClaw via CLI ────────────────────────────────────
echo "==> Configuring OpenClaw..."
openclaw config set gateway.bind loopback
openclaw config set gateway.mode local
openclaw config set channels.telegram.enabled true
openclaw config set channels.telegram.botToken "${TELEGRAM_BOT_TOKEN}" > /dev/null 2>&1
openclaw config set channels.telegram.dmPolicy pairing
openclaw config set channels.telegram.groupPolicy disabled

# Model fallback chain: direct provider APIs (no OpenRouter)
# Claude is NOT in the auto-fallback chain (saves ~$44/mo). The Anthropic API key
# is still in /etc/openclaw.env so Claude can be used on-demand via manual requests.
GOOGLE_AI_API_KEY="${GOOGLE_AI_API_KEY}" openclaw models set google/gemini-2.5-flash
openclaw models fallbacks clear
OPENAI_API_KEY="${OPENAI_API_KEY}" openclaw models fallbacks add openai/gpt-4o-mini

# Generate a gateway auth token on first run only
EXISTING_TOKEN="$(openclaw config get gateway.auth.token 2>/dev/null || true)"
if [ -z "${EXISTING_TOKEN}" ] || echo "${EXISTING_TOKEN}" | grep -q "not found"; then
  GATEWAY_TOKEN="$(openssl rand -hex 32)"
  openclaw config set gateway.auth.token "${GATEWAY_TOKEN}" > /dev/null 2>&1
fi

# ── Environment file (secrets not visible in unit file) ──────────
cat > /etc/openclaw.env <<ENVFILE
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY}
GEMINI_API_KEY=${GOOGLE_AI_API_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
GMAIL_CREDENTIALS=${GMAIL_CREDENTIALS}
GITHUB_TOKEN=${GITHUB_TOKEN}
BEEHIIV_API_KEY=${BEEHIIV_API_KEY}
BEEHIIV_PUBLICATION_ID=${BEEHIIV_PUBLICATION_ID}
CONVEX_URL=${CONVEX_URL}
ENVFILE
chmod 600 /etc/openclaw.env

# ── Systemd unit ──────────────────────────────────────────────────
cat > /etc/systemd/system/openclaw.service <<UNIT
[Unit]
Description=OpenClaw Gateway
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
STARTUP_EOF

# ── Install plugin files on VM (copy + npm install, no config) ────────
# Each function copies files and installs deps. Config is set atomically
# by configure_all_plugins() after all plugins are installed — this avoids
# the "openclaw config set" global validation failure that occurs when any
# plugin has missing config.

install_convex_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/convex-knowledge"
  local PLUGIN_DEST="/root/.openclaw/extensions/convex-knowledge"

  echo "==> Installing Convex Knowledge plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/convex-knowledge-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/convex-knowledge-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/convex-knowledge-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_postiz_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/postiz"
  local PLUGIN_DEST="/root/.openclaw/extensions/postiz"

  echo "==> Installing Postiz plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/postiz-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/postiz-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/postiz-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_beehiiv_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/beehiiv"
  local PLUGIN_DEST="/root/.openclaw/extensions/beehiiv"

  echo "==> Installing Beehiiv plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/beehiiv-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/beehiiv-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/beehiiv-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_video_gen_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/video-gen"
  local PLUGIN_DEST="/root/.openclaw/extensions/video-gen"

  echo "==> Installing Video Gen plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/video-gen-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/video-gen-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/video-gen-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_github_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/github"
  local PLUGIN_DEST="/root/.openclaw/extensions/github"

  echo "==> Installing GitHub plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/github-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/github-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/github-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_dynoclux_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/dynoclux"
  local PLUGIN_DEST="/root/.openclaw/extensions/dynoclux"

  echo "==> Installing DynoClux plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/dynoclux-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/dynoclux-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/dynoclux-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_image_gen_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/image-gen"
  local PLUGIN_DEST="/root/.openclaw/extensions/image-gen"

  echo "==> Installing Image Gen plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/image-gen-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/image-gen-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/image-gen-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_dynosist_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/dynosist"
  local PLUGIN_DEST="/root/.openclaw/extensions/dynosist"

  echo "==> Installing DynoSist plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/dynosist-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/dynosist-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/dynosist-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_web_tools_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/web-tools"
  local PLUGIN_DEST="/root/.openclaw/extensions/web-tools"

  echo "==> Installing Web Tools plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/web-tools-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/web-tools-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/web-tools-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_twitter_research_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/twitter-research"
  local PLUGIN_DEST="/root/.openclaw/extensions/twitter-research"

  echo "==> Installing Twitter Research plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/twitter-research-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/twitter-research-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/twitter-research-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_youtube_transcriber_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/youtube-transcriber"
  local PLUGIN_DEST="/root/.openclaw/extensions/youtube-transcriber"

  echo "==> Installing YouTube Transcriber plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/youtube-transcriber-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/youtube-transcriber-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/youtube-transcriber-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_carousel_gen_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/carousel-gen"
  local PLUGIN_DEST="/root/.openclaw/extensions/carousel-gen"

  echo "==> Installing Carousel Gen plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST}/templates && mkdir -p /tmp/carousel-gen-plugin/templates"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/carousel-gen-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute scp \
    "${PLUGIN_SRC}/templates/professional.ts" \
    "${PLUGIN_SRC}/templates/bold.ts" \
    "${PLUGIN_SRC}/templates/minimal.ts" \
    "${VM_NAME}:/tmp/carousel-gen-plugin/templates/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/carousel-gen-plugin/*.json /tmp/carousel-gen-plugin/*.ts ${PLUGIN_DEST}/ && \
        sudo cp /tmp/carousel-gen-plugin/templates/* ${PLUGIN_DEST}/templates/ && \
        sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

install_agentmail_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/agentmail"
  local PLUGIN_DEST="/root/.openclaw/extensions/agentmail"

  echo "==> Installing AgentMail plugin files..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST} && mkdir -p /tmp/agentmail-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/agentmail-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/agentmail-plugin/* ${PLUGIN_DEST}/ && \
        sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev'"
}

# ── Initialize QMD memory backend ────────────────────────────────────
init_qmd_memory() {
  echo "==> Initializing QMD memory backend (update + embed)..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo bash -c 'export BUN_INSTALL=/root/.bun && export PATH=\${BUN_INSTALL}/bin:\${PATH} && \
        export XDG_CONFIG_HOME=/root/.openclaw/agents/main/qmd/xdg-config && \
        export XDG_CACHE_HOME=/root/.openclaw/agents/main/qmd/xdg-cache && \
        mkdir -p \${XDG_CONFIG_HOME} \${XDG_CACHE_HOME} && \
        qmd update && qmd embed && \
        echo "QMD index built successfully" && \
        qmd query "test" -c memory-root --json 2>/dev/null | head -5 && \
        echo "QMD verification complete"'
}

# ── Configure all plugins atomically ─────────────────────────────────
# Fetches all secrets, then patches openclaw.json with plugin entries in
# one shot. This avoids the global validation issue with `openclaw config set`.
configure_all_plugins() {
  echo "==> Fetching plugin secrets..."
  local CONVEX_URL POSTIZ_URL POSTIZ_API_KEY BEEHIIV_API_KEY BEEHIIV_PUB_ID GOOGLE_AI_API_KEY OPENAI_API_KEY DRIVE_FOLDER_ID DRIVE_CLIENT_ID DRIVE_CLIENT_SECRET DRIVE_REFRESH_TOKEN GITHUB_TOKEN GITHUB_DEFAULT_OWNER GMAIL_REFRESH_TOKEN AGENTMAIL_API_KEY
  CONVEX_URL="$(gcloud secrets versions access latest --secret=convex-url --project="${PROJECT}")"
  POSTIZ_URL="$(gcloud secrets versions access latest --secret=postiz-url --project="${PROJECT}")"
  POSTIZ_API_KEY="$(gcloud secrets versions access latest --secret=postiz-api-key --project="${PROJECT}")"
  BEEHIIV_API_KEY="$(gcloud secrets versions access latest --secret=beehiiv-api-key --project="${PROJECT}")"
  BEEHIIV_PUB_ID="$(gcloud secrets versions access latest --secret=beehiiv-publication-id --project="${PROJECT}")"
  GOOGLE_AI_API_KEY="$(gcloud secrets versions access latest --secret=google-ai-api-key --project="${PROJECT}")"
  OPENAI_API_KEY="$(gcloud secrets versions access latest --secret=openai-api-key --project="${PROJECT}" || true)"
  DRIVE_FOLDER_ID="$(gcloud secrets versions access latest --secret=drive-media-folder-id --project="${PROJECT}" || true)"
  DRIVE_CLIENT_ID="$(gcloud secrets versions access latest --secret=drive-oauth-client-id --project="${PROJECT}" || true)"
  DRIVE_CLIENT_SECRET="$(gcloud secrets versions access latest --secret=drive-oauth-client-secret --project="${PROJECT}" || true)"
  DRIVE_REFRESH_TOKEN="$(gcloud secrets versions access latest --secret=drive-oauth-refresh-token --project="${PROJECT}" || true)"
  GITHUB_TOKEN="$(gcloud secrets versions access latest --secret=github-token --project="${PROJECT}" || true)"
  GITHUB_DEFAULT_OWNER="$(gcloud secrets versions access latest --secret=github-default-owner --project="${PROJECT}" || echo "Adawodu")"
  GMAIL_REFRESH_TOKEN="$(gcloud secrets versions access latest --secret=gmail-oauth-refresh-token --project="${PROJECT}" || true)"
  TWITTER_BEARER_TOKEN="$(gcloud secrets versions access latest --secret=twitter-bearer-token --project="${PROJECT}" || true)"
  AGENTMAIL_API_KEY="$(gcloud secrets versions access latest --secret=agentmail-api-key --project="${PROJECT}" || true)"

  echo "==> Patching openclaw.json with plugin configs..."
  # Build a node script that reads current config and merges plugin entries
  local PATCH_SCRIPT
  PATCH_SCRIPT=$(cat <<'NODESCRIPT'
const fs = require("fs");
const configPath = "/root/.openclaw/openclaw.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.plugins = config.plugins || {};
config.plugins.entries = Object.assign(config.plugins.entries || {}, {
  "convex-knowledge": { enabled: true, config: { convexUrl: process.env.CONVEX_URL } },
  "postiz": { enabled: true, config: { postizUrl: process.env.POSTIZ_URL, postizApiKey: process.env.POSTIZ_API_KEY } },
  "beehiiv": { enabled: true, config: { beehiivApiKey: process.env.BEEHIIV_API_KEY, beehiivPublicationId: process.env.BEEHIIV_PUB_ID } },
  "video-gen": { enabled: true, config: { geminiApiKey: process.env.GOOGLE_AI_API_KEY, openaiApiKey: process.env.OPENAI_API_KEY, convexUrl: process.env.CONVEX_URL || undefined, driveFolderId: process.env.DRIVE_FOLDER_ID || undefined, driveClientId: process.env.DRIVE_CLIENT_ID || undefined, driveClientSecret: process.env.DRIVE_CLIENT_SECRET || undefined, driveRefreshToken: process.env.DRIVE_REFRESH_TOKEN || undefined } },
  "image-gen": { enabled: true, config: { geminiApiKey: process.env.GOOGLE_AI_API_KEY, openaiApiKey: process.env.OPENAI_API_KEY, convexUrl: process.env.CONVEX_URL || undefined, driveFolderId: process.env.DRIVE_FOLDER_ID || undefined, driveClientId: process.env.DRIVE_CLIENT_ID || undefined, driveClientSecret: process.env.DRIVE_CLIENT_SECRET || undefined, driveRefreshToken: process.env.DRIVE_REFRESH_TOKEN || undefined } },
  "github": { enabled: true, config: { githubToken: process.env.GITHUB_TOKEN, defaultOwner: process.env.GITHUB_DEFAULT_OWNER || "Adawodu" } },
  "dynoclux": { enabled: true, config: { gmailClientId: process.env.DRIVE_CLIENT_ID, gmailClientSecret: process.env.DRIVE_CLIENT_SECRET, gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN, convexUrl: process.env.CONVEX_URL } },
  "dynosist": { enabled: true, config: { gmailClientId: process.env.DRIVE_CLIENT_ID, gmailClientSecret: process.env.DRIVE_CLIENT_SECRET, gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN } },
  "web-tools": { enabled: true, config: {} },
  "twitter-research": { enabled: true, config: { bearerToken: process.env.TWITTER_BEARER_TOKEN || undefined } },
  "youtube-transcriber": { enabled: true, config: {} },
  "carousel-gen": { enabled: true, config: { convexUrl: process.env.CONVEX_URL || undefined, driveFolderId: process.env.DRIVE_FOLDER_ID || undefined, driveClientId: process.env.DRIVE_CLIENT_ID || undefined, driveClientSecret: process.env.DRIVE_CLIENT_SECRET || undefined, driveRefreshToken: process.env.DRIVE_REFRESH_TOKEN || undefined } },
  "agentmail": { enabled: true, config: { agentmailApiKey: process.env.AGENTMAIL_API_KEY, inboxId: "jonnymate@agentmail.to" } }
});
// Ensure all plugins are in the allowlist
const allPlugins = ["postiz", "convex-knowledge", "image-gen", "video-gen", "beehiiv", "telegram", "twitter-research", "github", "dynoclux", "dynosist", "web-tools", "youtube-transcriber", "carousel-gen", "agentmail"];
config.plugins.allow = config.plugins.allow || [];
for (const p of allPlugins) { if (!config.plugins.allow.includes(p)) config.plugins.allow.push(p); }
// Configure QMD memory backend
config.memory = {
  backend: "qmd",
  citations: "auto",
  qmd: {
    command: "qmd",
    searchMode: "search",
    includeDefaultMemory: true,
    update: {
      interval: "5m",
      debounceMs: 15000,
      onBoot: true,
      waitForBootSync: false
    },
    limits: {
      maxResults: 6,
      maxSnippetChars: 2000,
      timeoutMs: 4000
    },
    paths: [
      { name: "workspace-memory", path: "/root/.openclaw/workspace/memory", pattern: "**/*.md" },
      { name: "skills", path: "/root/.openclaw/skills", pattern: "**/*.md" },
      { name: "agents-shared", path: "/root/.openclaw/workspace/agents/shared", pattern: "**/*.md" }
    ]
  }
};
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("Plugin + QMD memory configs written successfully");
NODESCRIPT
)

  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo CONVEX_URL='${CONVEX_URL}' POSTIZ_URL='${POSTIZ_URL}' POSTIZ_API_KEY='${POSTIZ_API_KEY}' BEEHIIV_API_KEY='${BEEHIIV_API_KEY}' BEEHIIV_PUB_ID='${BEEHIIV_PUB_ID}' GOOGLE_AI_API_KEY='${GOOGLE_AI_API_KEY}' OPENAI_API_KEY='${OPENAI_API_KEY}' DRIVE_FOLDER_ID='${DRIVE_FOLDER_ID}' DRIVE_CLIENT_ID='${DRIVE_CLIENT_ID}' DRIVE_CLIENT_SECRET='${DRIVE_CLIENT_SECRET}' DRIVE_REFRESH_TOKEN='${DRIVE_REFRESH_TOKEN}' GITHUB_TOKEN='${GITHUB_TOKEN}' GITHUB_DEFAULT_OWNER='${GITHUB_DEFAULT_OWNER}' GMAIL_REFRESH_TOKEN='${GMAIL_REFRESH_TOKEN}' TWITTER_BEARER_TOKEN='${TWITTER_BEARER_TOKEN}' AGENTMAIL_API_KEY='${AGENTMAIL_API_KEY}' node -e '${PATCH_SCRIPT}'"

  echo "==> Restarting OpenClaw..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo systemctl restart openclaw"
}

# ── Install all skills on VM via single tar + SCP + SSH ──────────────
install_skills() {
  local SKILLS_ROOT="${SCRIPT_DIR}/../../skills"
  local SKILLS_DEST="/root/.openclaw/skills"

  echo "==> Bundling skills into tarball..."
  local TARBALL="$(mktemp /tmp/skills-XXXXXX.tar.gz)"
  tar -czf "${TARBALL}" -C "${SKILLS_ROOT}" \
    daily-briefing/SKILL.md \
    job-hunter/SKILL.md \
    content-engine/SKILL.md \
    daily-posts/SKILL.md \
    newsletter-writer/SKILL.md \
    engagement-monitor/SKILL.md \
    dynoclux/SKILL.md \
    growth-hacker/SKILL.md \
    product-update/SKILL.md \
    dynosist/SKILL.md \
    agentmail/SKILL.md \
    agent-browser/SKILL.md \
    comic-brief/SKILL.md \
    agent-browser/references/commands.md \
    agent-browser/references/snapshot-refs.md \
    agent-browser/references/session-management.md \
    agent-browser/references/authentication.md \
    agent-browser/references/video-recording.md \
    agent-browser/references/profiling.md \
    agent-browser/references/proxy-support.md \
    agent-browser/templates/form-automation.sh \
    agent-browser/templates/authenticated-session.sh \
    agent-browser/templates/capture-workflow.sh

  echo "==> Copying skills tarball to VM..."
  gcloud compute scp "${TARBALL}" \
    "${VM_NAME}:/tmp/skills.tar.gz" \
    --zone="${ZONE}" --project="${PROJECT}"
  rm -f "${TARBALL}"

  echo "==> Extracting skills and registering cron jobs..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${SKILLS_DEST} && sudo tar -xzf /tmp/skills.tar.gz -C ${SKILLS_DEST} && rm -f /tmp/skills.tar.gz && \
sudo openclaw cron add --name 'daily-briefing' --cron '0 13 * * *' --message '/daily-briefing' || echo 'Cron may exist'; \
sudo openclaw cron add --name 'content-engine' --cron '0 1 * * 1' --message '/content-engine' || echo 'Cron may exist'; \
sudo openclaw cron add --name 'daily-posts' --cron '0 13 * * *' --message '/daily-posts' || echo 'Cron may exist'; \
sudo openclaw cron add --name 'newsletter-writer' --cron '0 14 * * 2' --message '/newsletter-writer' || echo 'Cron may exist'; \
sudo openclaw cron add --name 'engagement-monitor' --cron '0 18 * * 5' --message '/engagement-monitor' || echo 'Cron may exist'"
}

# ── Create or reset VM ───────────────────────────────────────────────
echo "==> Creating VM: ${VM_NAME}..."
gcloud compute instances describe "${VM_NAME}" \
  --zone="${ZONE}" --project="${PROJECT}" 2>/dev/null \
&& echo "VM already exists — updating startup script..." \
&& gcloud compute instances add-metadata "${VM_NAME}" \
  --zone="${ZONE}" --project="${PROJECT}" \
  --metadata-from-file=startup-script="${STARTUP_FILE}" \
&& gcloud compute instances reset "${VM_NAME}" \
  --zone="${ZONE}" --project="${PROJECT}" \
|| gcloud compute instances create "${VM_NAME}" \
  --zone="${ZONE}" \
  --project="${PROJECT}" \
  --machine-type="${MACHINE_TYPE}" \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --service-account="${SA_EMAIL}" \
  --scopes=cloud-platform \
  --tags=openclaw \
  --metadata-from-file=startup-script="${STARTUP_FILE}" \
  --no-address

# Wait for startup script to finish, then install plugin
echo "==> Waiting for VM startup script to complete..."
sleep 90
install_convex_plugin
install_postiz_plugin
install_beehiiv_plugin
install_video_gen_plugin
install_image_gen_plugin
install_github_plugin
install_dynoclux_plugin
install_dynosist_plugin
install_web_tools_plugin
install_twitter_research_plugin
install_youtube_transcriber_plugin
install_carousel_gen_plugin
install_agentmail_plugin
configure_all_plugins
install_skills
init_qmd_memory

echo ""
echo "==> Deploy complete!"
echo ""
echo "Next steps:"
echo "  1. Wait ~2 min for startup script to finish"
echo "  2. Check status:  gcloud compute ssh ${VM_NAME} --zone=${ZONE} -- openclaw status"
echo "  3. SSH tunnel:    gcloud compute ssh ${VM_NAME} --zone=${ZONE} -- -L 18789:localhost:18789"
echo "  4. Pair Telegram: openclaw pairing approve telegram <CODE>"
