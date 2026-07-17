#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

echo "⚡ SKYNET-CORP INSTALLER"
echo "========================"

# Fix: use only pure Python packages that work on Android ARM64
pip install requests --break-system-packages -q
echo "✅ requests"

pip install openai --break-system-packages -q 2>/dev/null && echo "✅ openai" || echo "⚠️ openai skip"

# Create directory structure
CORP="/storage/emulated/0/SKYNET-CORP"
mkdir -p "$CORP"/{brain,agents,memory,logs,jobs,projects,scripts,boot}
mkdir -p "$CORP/projects/atlas-os"
mkdir -p "$CORP/projects/arena-os"
mkdir -p "$CORP/memory/index"
mkdir -p "$CORP/memory/snapshots"

echo "✅ Directories created"
echo ""
echo "SKYNET-CORP root: $CORP"
echo "Next: paste chunk 2"
