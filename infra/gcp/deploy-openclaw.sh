#!/usr/bin/env bash
#
# deploy-openclaw.sh — provision a GCP Compute Engine VM running OpenClaw.
#
# Prerequisites:
#   - gcloud CLI authenticated with appropriate permissions
#   - Secrets already created in Secret Manager:
#       telegram-bot-token, anthropic-api-key
#       (gmail-credentials, github-token, beehiiv-api-key as needed)
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
gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}" 2>/dev/null \
|| gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="OpenClaw SA" \
  --project="${PROJECT}"

# Brief pause to allow IAM propagation after SA creation
sleep 10

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
MARKER="/var/run/openclaw-installed"

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
OPENROUTER_API_KEY="$(fetch_secret openrouter-api-key || true)"

# ── Configure OpenClaw via CLI ────────────────────────────────────
echo "==> Configuring OpenClaw..."
openclaw config set gateway.bind loopback
openclaw config set gateway.mode local
openclaw config set channels.telegram.enabled true
openclaw config set channels.telegram.botToken "${TELEGRAM_BOT_TOKEN}"
openclaw config set channels.telegram.dmPolicy pairing
openclaw config set channels.telegram.groupPolicy disabled

# Model fallback chain: free OpenRouter model → Claude as paid fallback
OPENROUTER_API_KEY="${OPENROUTER_API_KEY}" openclaw models set openrouter/qwen/qwen3-vl-30b-a3b-thinking
openclaw models fallbacks clear
openclaw models fallbacks add anthropic/claude-sonnet-4-5-20250929

# Generate a gateway auth token for security
GATEWAY_TOKEN="$(openssl rand -hex 32)"
openclaw config set gateway.auth.token "${GATEWAY_TOKEN}"

# ── Systemd unit ──────────────────────────────────────────────────
cat > /etc/systemd/system/openclaw.service <<UNIT
[Unit]
Description=OpenClaw Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
Environment=GMAIL_CREDENTIALS=${GMAIL_CREDENTIALS}
Environment=GITHUB_TOKEN=${GITHUB_TOKEN}
Environment=BEEHIIV_API_KEY=${BEEHIIV_API_KEY}
Environment=OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
ExecStartPre=/usr/bin/env openclaw security audit --fix
ExecStart=/usr/bin/env openclaw gateway run --bind loopback
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable openclaw
systemctl restart openclaw
echo "==> OpenClaw gateway started"
STARTUP_EOF

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

echo ""
echo "==> Deploy complete!"
echo ""
echo "Next steps:"
echo "  1. Wait ~2 min for startup script to finish"
echo "  2. Check status:  gcloud compute ssh ${VM_NAME} --zone=${ZONE} -- openclaw status"
echo "  3. SSH tunnel:    gcloud compute ssh ${VM_NAME} --zone=${ZONE} -- -L 18789:localhost:18789"
echo "  4. Pair Telegram: openclaw pairing approve telegram <CODE>"
