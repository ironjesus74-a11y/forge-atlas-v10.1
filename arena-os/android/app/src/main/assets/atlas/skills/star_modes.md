# Atlas Star Modes

Installed commands:

## atlas-star
Highest-quality executable mode.

Usage:
atlas-star "task"

Use for:
- debugging
- repo work
- APK repair
- planning that must become commands
- careful high-quality work

## atlas-appmode
App idea to APK mode.

Usage:
atlas-appmode "app idea"

Behavior:
- asks up to 5 questions
- runs atlas-appforge new
- watches GitHub Actions
- repairs failures if possible
- reports APK artifact

## atlas-repair-build
GitHub Actions repair loop.

Usage:
atlas-repair-build owner/repo /local/path

Behavior:
- inspect latest failed logs
- fix first real issue
- commit/push
- rerun Actions
- download/report APK artifact

Principles:
- artifact over claims
- logs over guesses
- GitHub Actions for Android APK builds
- no general advice unless asked
