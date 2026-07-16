#!/data/data/com.termux/files/usr/bin/bash

echo "🛡 Atlas Guardian Starting"

if git status --porcelain | grep -q "^"; then
    echo "Changes detected"
else
    echo "Clean state"
fi

if git ls-files -u | grep -q .; then
    echo "Merge conflicts detected"

    git checkout --ours .

    git add .

    git commit -m "guardian: auto resolve using protected Atlas version"

    echo "Conflicts repaired"
else
    echo "No conflicts"
fi

echo "Atlas Guardian complete"
