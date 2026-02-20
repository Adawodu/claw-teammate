#!/usr/bin/env bash
#
# startup.sh — idempotent boot script for the OpenClaw VM.
# Fetches secrets from GCP Secret Manager, writes config, starts gateway.
#
set -euo pipefail

OPENCLAW_DIR="/opt/openclaw"
CONFIG_TEMPLATE="${OPENCLAW_DIR}/config-template.jsonc"
CONFIG_FILE="${OPENCLAW_DIR}/config.jsonc"

# ── Fetch secrets from Secret Manager ────────────────────────────────
fetch_secret() {
  gcloud secrets versions access latest --secret="$1" 2>/dev/null
}

echo "==> Fetching secrets from Secret Manager..."
TELEGRAM_BOT_TOKEN="$(fetch_secret telegram-bot-token)"
ANTHROPIC_API_KEY="$(fetch_secret anthropic-api-key)"

GOOGLE_AI_API_KEY="$(fetch_secret google-ai-api-key)"  # Required — primary model

# Optional secrets — leave empty if not yet created
GMAIL_CREDENTIALS="$(fetch_secret gmail-credentials || true)"
GITHUB_TOKEN="$(fetch_secret github-token || true)"
BEEHIIV_API_KEY="$(fetch_secret beehiiv-api-key || true)"
OPENAI_API_KEY="$(fetch_secret openai-api-key || true)"

# ── Write config with real values ────────────────────────────────────
echo "==> Writing OpenClaw config..."
sed 's|\${TELEGRAM_BOT_TOKEN}|'"${TELEGRAM_BOT_TOKEN}"'|g' \
  "${CONFIG_TEMPLATE}" > "${CONFIG_FILE}"

chmod 600 "${CONFIG_FILE}"

# ── Export env vars for integrations ─────────────────────────────────
export ANTHROPIC_API_KEY
export GOOGLE_AI_API_KEY
export OPENAI_API_KEY
export GMAIL_CREDENTIALS
export GITHUB_TOKEN
export BEEHIIV_API_KEY

# ── Security audit ───────────────────────────────────────────────────
echo "==> Running security audit..."
openclaw security audit --fix || true

# ── Start gateway ────────────────────────────────────────────────────
echo "==> Starting OpenClaw gateway..."
exec openclaw gateway run --bind loopback
