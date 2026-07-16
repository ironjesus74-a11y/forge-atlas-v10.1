#!/data/data/com.termux/files/usr/bin/bash

echo "================================"
echo "🔥 FORGE ATLAS STATUS"
echo "================================"

echo ""

echo "SYSTEM:"
cat .atlas/bridge/atlas-config.json

echo ""

echo "AGENTS:"
cat .atlas/agents/registry.json

echo ""

echo "WORKFLOWS:"
cat .atlas/workflows/workflow-registry.json

echo ""

echo "GIT:"
git status

echo ""
echo "LAST BUILD:"
git log --oneline -5
