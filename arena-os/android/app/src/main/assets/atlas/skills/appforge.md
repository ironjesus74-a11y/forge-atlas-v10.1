# AppForge SDK Skill

Purpose:
Create, repair, iterate, icon, inspect APKs, and escalate Android APK projects using Termux + private GitHub repos + GitHub Actions.

Rules:
- One AppForge repo task at a time.
- Do not create duplicate repos.
- GitHub Actions builds APKs.
- Logs beat guesses.
- Build artifact required before claiming success.
- Use appforge-iterate when the user dislikes an APK.
- Use appforge-icon before polished delivery.
- Use appforge-repair for failed builds.
- Use appforge-escalate when stuck.
- Use atlas-apktool only for authorized APK debugging/research.
- Use atlas-menu or help for current environment/project map.

Important commands:
- appforge-new-safe
- atlas-appforge new
- appforge-repair owner/repo /path
- appforge-iterate owner/repo /path "feedback"
- appforge-escalate owner/repo /path
- appforge-icon /path "App Name" "style"
- appforge-selfcheck /path
- atlas-apktool inspect file.apk
- atlas-menu
