# Test APK build (EAS preview)

**Status on this cloud VM:** blocked — no Expo login / no `EXPO_TOKEN`.  
Full click-by-click: **`docs/EAS-RUNBOOK.md`**. Hosting overview: **`docs/HOSTING-RESTORE.md`**.

**Provisional download link:** https://github.com/jejedu13376/urgency-the-road/releases

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

## What this agent already ran

```text
npx eas-cli whoami
→ Not logged in

eas build -p android --profile preview --non-interactive
→ An Expo user account is required to proceed.
```

No APK URL until login (or `EXPO_TOKEN`) and a successful build.
