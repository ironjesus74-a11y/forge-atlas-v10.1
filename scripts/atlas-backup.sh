#!/data/data/com.termux/files/usr/bin/bash

DATE=$(date +"%Y-%m-%d-%H%M")

mkdir -p .atlas/logs

git tag "atlas-auto-$DATE"

echo "Backup created:"
echo "atlas-auto-$DATE"
