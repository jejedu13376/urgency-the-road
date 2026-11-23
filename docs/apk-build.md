# Test APK build (EAS preview)

**Status (2026-11-23):** `EXPO_TOKEN` **present + valid** on cloud VM (`eas whoami` → `jejedu13376`).  
Preview APK **FINISHED**: build `e36fd307` —  
https://expo.dev/accounts/jejedu13376/projects/urgency-road-one/builds/e36fd307-416c-474f-aa31-bc7433d65064  
**APK:** https://expo.dev/artifacts/eas/9jnRpoYEjSrzH8b4wPGgg72rsW3xBKgeX7zfXxuHkZI.apk  

Full click-by-click: **`docs/EAS-RUNBOOK.md`**. Hosting overview: **`docs/HOSTING-RESTORE.md`**.

`eas.json` is ready with a **preview** profile that outputs an **APK** (no production keystore) and a **development** profile for BLE Dev Client.

## Free Expo account (exact steps)

1. Open https://expo.dev/signup and create a **free** account (email/GitHub/Google).
2. On your PC (or this machine after auth):

```powershell
cd /path/to/urgency-the-road
npm install
npx eas-cli login
```

3. Complete the browser/device login prompt until `npx eas-cli whoami` prints your username.

**CI / cloud-agent alternative:** https://expo.dev/accounts/[account]/settings/access-tokens → create token → set Cursor secret `EXPO_TOKEN` → re-run agent build.

## Link project + build APK

```powershell
npx eas-cli build:configure
npx eas-cli build -p android --profile preview
```

- First run may ask to create an EAS project — accept defaults (writes `extra.eas.projectId`).
- Profile `preview` → `android.buildType: apk`, `distribution: internal`.
- When **Finished**, open the build page → **Download** `.apk`.

## Download URL shape

```text
https://expo.dev/accounts/<account>/projects/urgency-road-one/builds/<build-id>
```

## What cloud agents already ran

```text
npx eas-cli whoami
→ jejedu13376 (authenticated using EXPO_TOKEN)

eas build -p android --profile preview --non-interactive
→ FINISHED (e36fd307-416c-474f-aa31-bc7433d65064)
```

Suggested app `.env` (Module 16 partage): set `EXPO_PUBLIC_INSTALL_URL` to the build page or APK URL above.
