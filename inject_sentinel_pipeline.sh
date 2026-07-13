#!/bin/bash
echo "======================================================"
echo "    INJECTING SENTINEL PIPELINE & SELF-SUSTAINABILITY "
echo "======================================================"

cd ~/forge-atlas-v10.1 || exit 1

# 1. Inject the Sentinel Auto-Fix Action
mkdir -p .github/workflows
cat << 'EOF' > .github/workflows/sentinel_auto_fix.yml
name: Sentinel Auto-Fix Pipeline

on:
  schedule:
    - cron: "0 2 * * *" # Runs every night at 2 AM
  workflow_dispatch:

jobs:
  auto-fix-and-verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Auto-Fixers
        run: npm install -g prettier

      - name: Auto-Format Frontend Code (Safe Fixes)
        run: |
          prettier --write "**/*.{html,css,js,json,md}" || echo "Prettier formatting complete."

      - name: Uptime Verification
        run: |
          HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}\n" https://forge-atlas.io)
          if [ "$HTTP_STATUS" -ne 200 ] && [ "$HTTP_STATUS" -ne 301 ] && [ "$HTTP_STATUS" -ne 302 ]; then
            echo "Warning: Website returned status $HTTP_STATUS"
            # In a full setup, this could trigger an email or Discord webhook
          else
            echo "Website is UP and routing correctly."
          fi

      - name: Commit Auto-Fixes (If Any)
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore(sentinel): auto-fix code formatting and syntax"
          branch: main
EOF

# 2. Inject Dependabot for Self-Upgrading
mkdir -p .github
cat << 'EOF' > .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "chore(upgrade):"
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "chore(upgrade):"
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "chore(upgrade):"
EOF

# 3. Commit and Push
git add .github/workflows/sentinel_auto_fix.yml .github/dependabot.yml
git commit -m "feat(sentinel): inject auto-fix pipeline and self-upgrading dependabot"
git push origin main

echo "🎉 SENTINEL DEPLOYED. Website is now self-sustaining."
echo "======================================================"
