#!/data/data/com.termux/files/usr/bin/bash

echo "🧬 Atlas Evolution Engine"

echo ""
echo "Scanning..."

./scripts/atlas-health.sh

echo ""
echo "Checking Git..."

git status

echo ""
echo "Creating checkpoint..."

git add .

git commit -m "Atlas evolution checkpoint $(date)"

echo ""
echo "Evolution complete"

