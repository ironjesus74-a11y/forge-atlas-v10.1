#!/data/data/com.termux/files/usr/bin/bash

clear

echo "================================"
echo "🔥 FORGE ATLAS COMMAND CENTER"
echo "================================"

echo ""

echo "SYSTEM"
cat .atlas/runtime/core/engine.json

echo ""

echo "TASK QUEUE"
cat .atlas/runtime/tasks/queue.json

echo ""

echo "PROVIDERS"
cat .atlas/runtime/providers/provider-manager.json

echo ""

echo "EVENT SYSTEM"
cat .atlas/events/event-schema.json

echo ""

echo "GIT"
git status --short

