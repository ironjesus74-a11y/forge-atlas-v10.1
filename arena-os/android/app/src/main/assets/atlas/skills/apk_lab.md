# APK Lab / apktool skill

Commands:
- apk-lab doctor
- apk-lab info file.apk
- apk-lab checksum file.apk
- apk-lab cert file.apk
- apk-lab inspect file.apk
- apk-lab decompile file.apk [outdir]
- apk-lab build decoded-dir
- apk-lab sign unsigned.apk [out.apk]
- apk-lab verify file.apk
- apk-lab compare one.apk two.apk
- apk-lab playcheck file.apk

Atlas wrapper:
- atlas-apktool setup
- atlas-apktool info file.apk
- atlas-apktool inspect file.apk
- atlas-apktool decompile file.apk [outdir]

Rules:
- Use only on APKs you own or have permission to analyze/modify.
- For Play Store, debug APK is not enough; prefer release signing and often AAB.
- Always inspect checksum/signature before and after modifications.
