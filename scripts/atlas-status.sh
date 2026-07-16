#!/data/data/com.termux/files/usr/bin/bash

echo "================================"
echo "🔥 FORGE ATLAS COMMAND CENTER"
echo "================================"

echo ""

echo "CORE"
cat .atlas/atlas-core.json

echo ""

echo "AGENTS"
cat .atlas/engine/agent-controller.json

echo ""

echo "RAG"
cat .atlas/rag/rag-engine.json

echo ""

echo "ARENA BRIDGE"
cat arena-os/bridge-sdk/bridge-contract.json

echo ""

echo "GIT"

git status --short

