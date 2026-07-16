#!/data/data/com.termux/files/usr/bin/bash

echo "🔥 FORGE ATLAS v10.2"

echo ""
echo "CORE"

cat .atlas/atlas-core.json

echo ""
echo "AI PROVIDERS"

cat .atlas/models/providers.json

echo ""
echo "AGENTS"

cat .atlas/agents/team.json

echo ""
echo "GIT"

git status --short
