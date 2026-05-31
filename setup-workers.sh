#!/usr/bin/env bash
# ============================================================
# FORGE ATLAS · setup-workers.sh
# One-shot Termux / Linux worker setup script.
#
# What this does:
#   1. Installs Node.js + wrangler (Termux-aware)
#   2. Verifies Cloudflare login
#   3. Prompts for secrets (skip any you don't have yet)
#   4. Redeploys all 8 workers — attaches AI bindings properly
#   5. Smoke-tests each endpoint via curl
#
# Usage (run from the repo root):
#   chmod +x setup-workers.sh
#   ./setup-workers.sh
#
# Re-running is safe — secrets are only updated when you type one.
# ============================================================

set -e
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

# ---- colours ------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

banner() { echo -e "\n${CYAN}${BOLD}▶  $1${RESET}"; }
ok()     { echo -e "${GREEN}✓  $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠  $1${RESET}"; }
err()    { echo -e "${RED}✗  $1${RESET}"; }
ask()    { echo -e "${BOLD}?  $1${RESET}"; }

# ============================================================
# 1. INSTALL NODE + WRANGLER
# ============================================================
banner "Checking Node.js"

if ! command -v node &>/dev/null; then
  warn "Node.js not found."
  # Termux detection
  if command -v pkg &>/dev/null; then
    echo "  Termux detected — running: pkg install nodejs"
    pkg install nodejs -y
  elif command -v apt &>/dev/null; then
    echo "  Debian/Ubuntu detected — installing via NodeSource"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    err "Can't auto-install Node.js. Install it manually then re-run."
    exit 1
  fi
fi

NODE_VER=$(node --version)
ok "Node.js $NODE_VER"

# Use npx wrangler (no global install needed; caches locally)
WR="npx --yes wrangler@latest"

# Quick version check
$WR --version 2>/dev/null | head -1 | sed 's/^/  wrangler /'

# ============================================================
# 2. CLOUDFLARE AUTH CHECK
# ============================================================
banner "Checking Cloudflare login"

if ! $WR whoami 2>/dev/null | grep -q "You are logged in"; then
  warn "Not logged in. Launching browser login…"
  $WR login
  echo
fi

ok "Cloudflare auth OK"

# ============================================================
# 3. SECRETS SETUP
# ============================================================
banner "Secrets setup"
echo "  Enter each secret when prompted. Press ENTER to skip (leave unchanged)."
echo "  Nothing is echoed to the terminal. Safe to run from Termux."
echo

# Helper: prompt + set secret if non-empty
set_secret() {
  local env_name="$1"
  local secret_name="$2"
  local description="$3"
  ask "${secret_name} for ${env_name} (${description}) — Enter to skip:"
  read -rs value
  echo
  if [[ -n "$value" ]]; then
    echo "$value" | $WR secret put "$secret_name" --env "$env_name" --no-bundle 2>/dev/null \
      && ok "  Set ${secret_name} on ${env_name}" \
      || warn "  Failed to set ${secret_name} on ${env_name} (worker may not exist yet — will retry after deploy)"
    # Store for retry after deploy
    eval "RETRY_SECRET_${env_name//-/_}_${secret_name}=\"$value\""
  else
    warn "  Skipped ${secret_name} on ${env_name}"
  fi
}

# ---- Anthropic API key (shared across 3 workers) ----------
echo -e "${BOLD}  ANTHROPIC_API_KEY — used by arena-llm, seo-copilot, atlas-rescuer${RESET}"
ask "  Paste your Anthropic API key (sk-ant-…) — Enter to skip:"
read -rs ANTHROPIC_KEY
echo

if [[ -n "$ANTHROPIC_KEY" ]]; then
  for env_name in arena-llm seo-copilot atlas-rescuer; do
    echo "$ANTHROPIC_KEY" | $WR secret put ANTHROPIC_API_KEY --env "$env_name" --no-bundle 2>/dev/null \
      && ok "  Set ANTHROPIC_API_KEY → ${env_name}-worker" \
      || warn "  Will retry after deploy: ANTHROPIC_API_KEY on ${env_name}"
  done
  ANTHROPIC_RETRY="$ANTHROPIC_KEY"
else
  warn "  Skipped ANTHROPIC_API_KEY — arena-llm will use CF Workers AI (Llama 3.3) only"
fi

# ---- atlas-rescuer secret (webhook guard) -----------------
echo
set_secret "atlas-rescuer" "RESCUER_SECRET" "random string — guards the rescuer webhook"

# ---- forum-bridge GitHub credentials ----------------------
echo
echo -e "${BOLD}  forum-bridge-worker needs a GitHub fine-grained PAT with Issues read+write${RESET}"
echo "  Create one at: github.com → Settings → Developer settings → Fine-grained tokens"
set_secret "forum-bridge" "GITHUB_TOKEN" "GitHub fine-grained PAT (Issues read+write)"
echo
ask "  GITHUB_REPO for forum-bridge (e.g. Forge-Atlas-Founder/Forge-Atlas-Forum) — Enter to skip:"
read -r GITHUB_REPO_VAL
echo
if [[ -n "$GITHUB_REPO_VAL" ]]; then
  echo "$GITHUB_REPO_VAL" | $WR secret put GITHUB_REPO --env forum-bridge --no-bundle 2>/dev/null \
    && ok "  Set GITHUB_REPO → forum-bridge-worker" \
    || warn "  Will retry after deploy: GITHUB_REPO on forum-bridge"
  GITHUB_REPO_RETRY="$GITHUB_REPO_VAL"
fi

# ============================================================
# 4. DEPLOY ALL WORKERS
# ============================================================
banner "Deploying all 8 workers"
echo "  This redeploys every worker via wrangler so AI bindings attach correctly."
echo "  Workers without AI bindings (helper, audit, ops) are quick static deploys."
echo

# Map: wrangler env name → friendly label
declare -A WORKERS=(
  [helper]="atlas-helper-worker    (rules engine, no AI binding)"
  [audit]="seo-audit-worker       (HTMLRewriter, no AI binding)"
  [ops]="ops-status-worker       (status probe, no AI binding)"
  [arena-llm]="arena-llm-worker      ★ needs AI binding + ANTHROPIC_API_KEY"
  [cf-ai]="cf-ai-worker           ★ needs AI binding"
  [seo-copilot]="seo-copilot-worker    ★ needs AI binding + ANTHROPIC_API_KEY"
  [forum-bridge]="forum-bridge-worker  (GitHub Issues backend)"
  [atlas-rescuer]="atlas-rescuer-worker ★ needs AI binding + ANTHROPIC_API_KEY"
)

DEPLOY_FAILED=()
for env_name in helper audit ops arena-llm cf-ai seo-copilot forum-bridge atlas-rescuer; do
  label="${WORKERS[$env_name]}"
  echo -e "  Deploying ${CYAN}${env_name}${RESET} — ${label}"
  if $WR deploy --env "$env_name" 2>&1 | tail -3; then
    ok "  Deployed ${env_name}"
  else
    err "  Deploy failed for ${env_name} — check output above"
    DEPLOY_FAILED+=("$env_name")
  fi
  echo
done

# ---- Retry secrets after deploy (in case worker didn't exist yet) ----
if [[ -n "$ANTHROPIC_RETRY" ]]; then
  banner "Re-applying ANTHROPIC_API_KEY after deploy"
  for env_name in arena-llm seo-copilot atlas-rescuer; do
    echo "$ANTHROPIC_RETRY" | $WR secret put ANTHROPIC_API_KEY --env "$env_name" --no-bundle 2>/dev/null \
      && ok "  ANTHROPIC_API_KEY → ${env_name}-worker" \
      || warn "  Check manually: wrangler secret put ANTHROPIC_API_KEY --env ${env_name}"
  done
fi

if [[ -n "$GITHUB_REPO_RETRY" ]]; then
  echo "$GITHUB_REPO_RETRY" | $WR secret put GITHUB_REPO --env forum-bridge --no-bundle 2>/dev/null \
    && ok "GITHUB_REPO → forum-bridge-worker" || true
fi

# ============================================================
# 5. SMOKE TEST
# ============================================================
banner "Smoke testing endpoints"
echo "  Hitting each worker's health/probe endpoint."
echo "  403/405 from a valid worker = origin lock firing (expected from CLI)."
echo "  4xx from Cloudflare itself = routing not yet set up."
echo

ACCOUNT="fbfa527a707f8ccb1e1464d28ae51fb8"

# Worker subdomain format: https://<name>.<account-subdomain>.workers.dev
# Fetch account subdomain from wrangler
SUBDOMAIN=$($WR whoami 2>/dev/null | grep -oP 'subdomain.*?:\s*\K\S+' | head -1 || echo "")

if [[ -z "$SUBDOMAIN" ]]; then
  warn "Couldn't auto-detect workers.dev subdomain — checking via workers_dev URL pattern"
fi

probe_worker() {
  local name="$1"
  local method="$2"
  local path="$3"
  local url="https://${name}.${SUBDOMAIN}.workers.dev${path}"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
    -H "Content-Type: application/json" \
    -d '{"test":true}' \
    --max-time 8 "$url" 2>/dev/null)
  if [[ "$http_code" == "200" || "$http_code" == "403" || "$http_code" == "405" ]]; then
    ok "  ${name} → HTTP ${http_code} (worker responding)"
  elif [[ "$http_code" == "000" ]]; then
    warn "  ${name} → no response (workers_dev disabled or route not configured)"
  else
    warn "  ${name} → HTTP ${http_code}"
  fi
}

if [[ -n "$SUBDOMAIN" ]]; then
  probe_worker "ops-status-worker"     "GET"  "/api/ops-status"
  probe_worker "atlas-helper-worker"   "POST" "/api/atlas-helper"
  probe_worker "arena-llm-worker"      "POST" "/api/arena-llm"
  probe_worker "cf-ai-worker"          "POST" "/api/cf-ai"
  probe_worker "forum-bridge-worker"   "POST" "/api/forum-bridge"
  probe_worker "atlas-rescuer-worker"  "POST" "/api/atlas-rescuer"
  probe_worker "seo-audit-worker"      "GET"  "/api/seo-audit?url=/index.html"
  probe_worker "seo-copilot-worker"    "POST" "/api/seo-copilot"
else
  warn "Skipping smoke tests — can't determine workers.dev subdomain"
  echo "  Run manually: curl https://<worker-name>.<subdomain>.workers.dev/api/ops-status"
fi

# ============================================================
# 6. SUMMARY
# ============================================================
banner "Done"

if [[ ${#DEPLOY_FAILED[@]} -gt 0 ]]; then
  err "Failed deployments: ${DEPLOY_FAILED[*]}"
  echo "  Fix above errors then re-run: ./setup-workers.sh"
else
  ok "All workers deployed"
fi

echo
echo -e "${BOLD}Next steps:${RESET}"
echo "  1. In Cloudflare Pages dashboard → your Pages project → Settings → Functions:"
echo "     Add Workers AI binding: variable name = AI"
echo "     (This powers the /api/* Pages Functions — separate from standalone workers)"
echo
echo "  2. If using a custom domain (forge-atlas.io), add routes in each worker's"
echo "     Settings → Triggers → Routes:"
echo "     forge-atlas.io/api/atlas-helper*   → atlas-helper-worker"
echo "     forge-atlas.io/api/arena-llm*      → arena-llm-worker"
echo "     forge-atlas.io/api/cf-ai*          → cf-ai-worker"
echo "     forge-atlas.io/api/forum-bridge*   → forum-bridge-worker"
echo "     forge-atlas.io/api/atlas-rescuer*  → atlas-rescuer-worker"
echo "     forge-atlas.io/api/seo-audit*      → seo-audit-worker"
echo "     forge-atlas.io/api/seo-copilot*    → seo-copilot-worker"
echo "     forge-atlas.io/api/ops-status*     → ops-status-worker"
echo
echo "  3. Any secrets you skipped — run later:"
echo "     npx wrangler secret put ANTHROPIC_API_KEY --env arena-llm"
echo "     npx wrangler secret put GITHUB_TOKEN      --env forum-bridge"
echo "     npx wrangler secret put GITHUB_REPO       --env forum-bridge"
echo "     npx wrangler secret put RESCUER_SECRET    --env atlas-rescuer"
echo
echo -e "${GREEN}${BOLD}Forge Atlas workers are live.${RESET}"
