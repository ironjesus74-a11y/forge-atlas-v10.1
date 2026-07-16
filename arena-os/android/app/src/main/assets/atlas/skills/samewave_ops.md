# SameWave Ops Skill

Use command:
samewave-ops

Purpose:
Audit SameWave source/APK and maintain invite/download/join flow.

Commands:
- samewave-ops audit
- samewave-ops landing
- samewave-ops tunnel
- samewave-ops patch-source URL
- samewave-ops links
- samewave-ops status
- samewave-ops all

Rules:
- Android cannot silently auto-install APKs.
- Best invite flow is landing page -> open app if installed -> download APK if not.
- Use samewave://session?id=ROOM for deep links.
- Use /download/SameWave-v3.apk for APK.
- If true audio sync is requested, verify real transport exists. Do not claim WebRTC/audio streaming unless code proves it.
