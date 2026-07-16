#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "🚀 Atlas Sync"

git fetch origin

git status

git merge origin/main --no-edit || {

echo "⚠ Conflict detected"

./scripts/atlas-repair.sh

}

git push origin main

echo "✅ Sync complete"
