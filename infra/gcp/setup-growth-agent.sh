#!/usr/bin/env bash
#
# setup-growth-agent.sh — Add a dedicated growth agent to the existing openclaw-vm.
#
# Prerequisites:
#   - openclaw-vm already running (deployed via deploy-openclaw.sh)
#   - gcloud CLI authenticated with appropriate permissions
#   - Secret created in Secret Manager: growth-telegram-bot-token
#   - New Telegram bot created via BotFather (@JonnymateGrowthBot)
#
# Usage:
#   GCP_PROJECT=my-project bash infra/gcp/setup-growth-agent.sh
#
set -euo pipefail

PROJECT="${GCP_PROJECT:?Set GCP_PROJECT}"
ZONE="${GCP_ZONE:-us-central1-a}"
VM_NAME="openclaw-vm"
AGENT_NAME="growth"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/../.."

echo "==> Setting up growth agent on ${VM_NAME}"

# ── 1. Add the growth agent (non-interactive with binding) ───────────
echo "==> Adding agent: ${AGENT_NAME}..."
gcloud compute ssh "${VM_NAME}" \
  --zone="${ZONE}" --project="${PROJECT}" \
  -- "sudo openclaw agents add ${AGENT_NAME} \
        --non-interactive \
        --workspace /root/.openclaw/workspace-growth \
        --bind telegram:growth \
        || echo 'Agent may already exist'"

# ── 2. Set agent identity ───────────────────────────────────────────
echo "==> Setting agent identity..."
gcloud compute ssh "${VM_NAME}" \
  --zone="${ZONE}" --project="${PROJECT}" \
  -- "sudo openclaw agents set-identity --agent ${AGENT_NAME} --name 'GrowthClaw' --emoji '📈'"

# ── 3. Copy SOUL.md to the growth agent dir ──────────────────────────
echo "==> Copying SOUL.md..."
gcloud compute scp \
  "${REPO_ROOT}/agents/growth/SOUL.md" \
  "${VM_NAME}:/tmp/growth-SOUL.md" \
  --zone="${ZONE}" --project="${PROJECT}"

gcloud compute ssh "${VM_NAME}" \
  --zone="${ZONE}" --project="${PROJECT}" \
  -- "sudo cp /tmp/growth-SOUL.md /root/.openclaw/agents/${AGENT_NAME}/agent/SOUL.md && \
      rm -f /tmp/growth-SOUL.md"

# ── 4. Copy all skills to the growth agent ───────────────────────────
echo "==> Installing skills on growth agent..."
TARBALL="$(mktemp /tmp/growth-skills-XXXXXX.tar.gz)"
tar -czf "${TARBALL}" -C "${REPO_ROOT}/skills" \
  content-engine/SKILL.md \
  daily-posts/SKILL.md \
  engagement-monitor/SKILL.md \
  newsletter-writer/SKILL.md \
  growth-hacker/SKILL.md

gcloud compute scp "${TARBALL}" \
  "${VM_NAME}:/tmp/growth-skills.tar.gz" \
  --zone="${ZONE}" --project="${PROJECT}"
rm -f "${TARBALL}"

gcloud compute ssh "${VM_NAME}" \
  --zone="${ZONE}" --project="${PROJECT}" \
  -- "sudo mkdir -p /root/.openclaw/agents/${AGENT_NAME}/agent/skills && \
      sudo tar -xzf /tmp/growth-skills.tar.gz -C /root/.openclaw/agents/${AGENT_NAME}/agent/skills && \
      rm -f /tmp/growth-skills.tar.gz"

# ── 5. Configure Telegram growth account with bot token ──────────────
echo "==> Fetching growth bot token from Secret Manager..."
GROWTH_BOT_TOKEN="$(gcloud secrets versions access latest \
  --secret=growth-telegram-bot-token \
  --project="${PROJECT}")"

echo "==> Configuring Telegram growth account..."
# Patch the growth account token directly in openclaw.json
# (openclaw channels add --name doesn't map to account ID correctly)
gcloud compute scp /dev/stdin "${VM_NAME}:/tmp/set-growth-token.js" \
  --zone="${ZONE}" --project="${PROJECT}" <<'NODESCRIPT'
const fs = require("fs");
const configPath = "/root/.openclaw/openclaw.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const tg = config.channels.telegram;
if (!tg.accounts) tg.accounts = {};
if (!tg.accounts.growth) tg.accounts.growth = { dmPolicy: "pairing", groupPolicy: "disabled" };
tg.accounts.growth.botToken = process.env.GROWTH_TOKEN;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("Growth Telegram token configured");
NODESCRIPT

gcloud compute ssh "${VM_NAME}" \
  --zone="${ZONE}" --project="${PROJECT}" \
  -- "sudo GROWTH_TOKEN='${GROWTH_BOT_TOKEN}' node /tmp/set-growth-token.js && rm /tmp/set-growth-token.js"

# ── 6. Register cron jobs for growth agent ───────────────────────────
echo "==> Registering cron jobs for growth agent..."
gcloud compute ssh "${VM_NAME}" \
  --zone="${ZONE}" --project="${PROJECT}" \
  -- "sudo openclaw cron add --agent ${AGENT_NAME} --name 'growth-content-engine' --cron '0 1 * * 1' --message '/content-engine' || echo 'Cron may exist'; \
      sudo openclaw cron add --agent ${AGENT_NAME} --name 'growth-daily-posts' --cron '0 14 * * *' --message '/daily-posts' || echo 'Cron may exist'; \
      sudo openclaw cron add --agent ${AGENT_NAME} --name 'growth-newsletter-writer' --cron '0 15 * * 2' --message '/newsletter-writer' || echo 'Cron may exist'; \
      sudo openclaw cron add --agent ${AGENT_NAME} --name 'growth-engagement-monitor' --cron '0 19 * * 5' --message '/engagement-monitor' || echo 'Cron may exist'"

# ── 7. Restart the gateway ───────────────────────────────────────────
echo "==> Restarting OpenClaw gateway..."
gcloud compute ssh "${VM_NAME}" \
  --zone="${ZONE}" --project="${PROJECT}" \
  -- "sudo systemctl restart openclaw"

echo ""
echo "==> Growth agent setup complete!"
echo ""
echo "Next steps:"
echo "  1. Verify agents: gcloud compute ssh ${VM_NAME} --zone=${ZONE} -- 'sudo openclaw agents list'"
echo "  2. Pair Telegram: message @JonnymateGrowthBot, then approve pairing on the VM"
echo "  3. Test: send /growth-hacker to the growth bot"
echo "  4. Verify main bot still works independently"
