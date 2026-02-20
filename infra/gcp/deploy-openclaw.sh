#!/usr/bin/env bash
#
# deploy-openclaw.sh — provision a GCP Compute Engine VM running OpenClaw.
#
# Prerequisites:
#   - gcloud CLI authenticated with appropriate permissions
#   - Secrets already created in Secret Manager:
#       telegram-bot-token, anthropic-api-key, google-ai-api-key,
#       openai-api-key, convex-url, beehiiv-publication-id
#       (gmail-credentials, github-token, beehiiv-api-key, postiz-url, postiz-api-key as needed)
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
  npm install -g openclaw@latest

  mkdir -p "${OPENCLAW_DIR}"
  touch "${MARKER}"
fi

# ── Fetch secrets ─────────────────────────────────────────────────
fetch_secret() {
  gcloud secrets versions access latest --secret="$1" 2>/dev/null
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
GOOGLE_AI_API_KEY="${GOOGLE_AI_API_KEY}" openclaw models set google/gemini-2.5-flash
openclaw models fallbacks clear
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" openclaw models fallbacks add anthropic/claude-sonnet-4-5-20250929
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

# ── Install Convex Knowledge plugin on VM via SSH + SCP ──────────────
install_convex_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/convex-knowledge"
  local PLUGIN_DEST="/root/.openclaw/extensions/convex-knowledge"

  echo "==> Creating plugin directory on VM..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST}"

  echo "==> Copying plugin files to VM..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "mkdir -p /tmp/convex-knowledge-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/convex-knowledge-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"

  echo "==> Installing plugin dependencies and enabling..."
  CONVEX_URL="$(gcloud secrets versions access latest --secret=convex-url --project="${PROJECT}")"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/convex-knowledge-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev && openclaw plugins enable convex-knowledge --config \"convexUrl=${CONVEX_URL}\" && systemctl restart openclaw'"
}

# ── Install Postiz plugin on VM via SSH + SCP ─────────────────────────
install_postiz_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/postiz"
  local PLUGIN_DEST="/root/.openclaw/extensions/postiz"

  echo "==> Creating Postiz plugin directory on VM..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST}"

  echo "==> Copying Postiz plugin files to VM..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "mkdir -p /tmp/postiz-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/postiz-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"

  echo "==> Installing Postiz plugin dependencies and enabling..."
  POSTIZ_URL="$(gcloud secrets versions access latest --secret=postiz-url --project="${PROJECT}")"
  POSTIZ_API_KEY="$(gcloud secrets versions access latest --secret=postiz-api-key --project="${PROJECT}")"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/postiz-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev && openclaw plugins enable postiz --config \"postizUrl=${POSTIZ_URL}\" --config \"postizApiKey=${POSTIZ_API_KEY}\" && systemctl restart openclaw'"
}

# ── Install Beehiiv plugin on VM via SSH + SCP ───────────────────────────
install_beehiiv_plugin() {
  local PLUGIN_SRC="${SCRIPT_DIR}/../../plugins/beehiiv"
  local PLUGIN_DEST="/root/.openclaw/extensions/beehiiv"

  echo "==> Creating Beehiiv plugin directory on VM..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo mkdir -p ${PLUGIN_DEST}"

  echo "==> Copying Beehiiv plugin files to VM..."
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "mkdir -p /tmp/beehiiv-plugin"
  gcloud compute scp \
    "${PLUGIN_SRC}/package.json" \
    "${PLUGIN_SRC}/index.ts" \
    "${PLUGIN_SRC}/openclaw.plugin.json" \
    "${VM_NAME}:/tmp/beehiiv-plugin/" \
    --zone="${ZONE}" --project="${PROJECT}"

  echo "==> Installing Beehiiv plugin dependencies and enabling..."
  BEEHIIV_API_KEY="$(gcloud secrets versions access latest --secret=beehiiv-api-key --project="${PROJECT}")"
  BEEHIIV_PUB_ID="$(gcloud secrets versions access latest --secret=beehiiv-publication-id --project="${PROJECT}")"
  gcloud compute ssh "${VM_NAME}" \
    --zone="${ZONE}" --project="${PROJECT}" \
    -- "sudo cp /tmp/beehiiv-plugin/* ${PLUGIN_DEST}/ && sudo bash -c 'cd ${PLUGIN_DEST} && npm install --omit=dev && openclaw plugins enable beehiiv --config \"beehiivApiKey=${BEEHIIV_API_KEY}\" --config \"beehiivPublicationId=${BEEHIIV_PUB_ID}\" && systemctl restart openclaw'"
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
    engagement-monitor/SKILL.md

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
install_skills

echo ""
echo "==> Deploy complete!"
echo ""
echo "Next steps:"
echo "  1. Wait ~2 min for startup script to finish"
echo "  2. Check status:  gcloud compute ssh ${VM_NAME} --zone=${ZONE} -- openclaw status"
echo "  3. SSH tunnel:    gcloud compute ssh ${VM_NAME} --zone=${ZONE} -- -L 18789:localhost:18789"
echo "  4. Pair Telegram: openclaw pairing approve telegram <CODE>"
