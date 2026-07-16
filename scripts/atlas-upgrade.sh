#!/data/data/com.termux/files/usr/bin/bash

echo "⚡ Atlas Upgrade Pipeline"

echo "Backup..."
./scripts/atlas-backup.sh

echo "Health..."
./scripts/atlas-health.sh

echo "Git checkpoint..."
git add .

git commit -m "Atlas automated upgrade checkpoint"

echo "Complete"

