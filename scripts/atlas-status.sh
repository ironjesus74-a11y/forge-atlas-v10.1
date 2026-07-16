#!/data/data/com.termux/files/usr/bin/bash

echo "================================"
echo "🔥 FORGE ATLAS v11"
echo "================================"

echo ""

echo "BRAIN"
cat .atlas/brain/decision-engine.json

echo ""

echo "AGENTS"
ls .atlas/agents/profiles

echo ""

echo "ARENA"
cat .atlas/arena/arena-v2.json

echo ""

echo "APK"
cat arena-os/app-manifest.json

echo ""

echo "GIT"
git status --short

