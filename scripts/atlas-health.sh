#!/data/data/com.termux/files/usr/bin/bash

echo "🛰 Atlas Intelligence Health Scan"

FILES=(
"index.html"
"challenge.html"
"fight-club.html"
"swarm.html"
"versus.html"
)

for FILE in "${FILES[@]}"
do
 if [ -f "$FILE" ]; then
   echo "✅ $FILE"
 else
   echo "❌ Missing $FILE"
 fi
done

echo ""
echo "Agents:"
cat .atlas/agents/registry.json

echo ""
echo "Workflows:"
cat .atlas/workflows/workflow-registry.json

echo ""
echo "Git:"
git status --short
