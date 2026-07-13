#!/bin/bash
echo "======================================================"
echo "    ATLAS SYNCHRONIZATION & AUTO-BACKUP PROTOCOL      "
echo "======================================================"

cd ~/forge-atlas-v10.1 || exit 1

echo "[1] Staging all unstaged changes..."
git add -A

echo "[2] Committing local changes to secure state..."
git commit -m "chore(sync): auto-backup local changes before sync" || echo "No new changes to commit."

echo "[3] Pulling remote AI modifications safely (Rebase)..."
git config pull.rebase true
git pull origin main

echo "[4] Pushing combined ecosystem to GitHub..."
git push origin main

echo "🎉 SYNCHRONIZATION COMPLETE. DAEMON IS LIVE."
echo "======================================================"
