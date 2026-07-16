# AppForge Repair Skill

Commands:
- appforge-repair owner/repo /local/repo/path
- appforge-escalate owner/repo /local/repo/path

Use appforge-repair when GitHub Actions Android APK build fails.

Known automatic repairs:
1. Invalid Android package name:
   - package lacks dot
   - manifest merger package error
   - fix namespace/applicationId/source path

2. Java compile syntax corruption:
   - class, interface, or enum expected
   - compileDebugJavaWithJavac
   - overwrites MainActivity.java with clean buildable scaffold

3. Missing debug.keystore:
   - generate debug.keystore
   - git add -f debug.keystore

Use appforge-escalate when automatic repair cannot identify the error. It creates a paste-ready prompt for Arena/stronger AI.

Rules:
- Logs beat guesses.
- Fix one real error at a time.
- Download only after successful artifact.
- Do not claim success until APK exists.
