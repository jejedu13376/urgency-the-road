# Test APK build (EAS preview)

**Status on this cloud VM:** blocked — no Expo login / no `EXPO_TOKEN`.  
`eas.json` is ready with a **preview** profile that outputs an **APK** (no production keystore).

## Free Expo account (exact steps)

1. Open https://expo.dev/signup and create a **free** account (email/GitHub/Google).
2. On your PC (or this machine after auth):

```powershell
cd C:\Users\Jejedou13376\Axarel\urgency-road-one
npm install
npx eas-cli login
```

3. Complete the browser/device login prompt until `npx eas-cli whoami` prints your username.

**CI alternative (no interactive login):** https://expo.dev/accounts/[account]/settings/access-tokens → create token → set env `EXPO_TOKEN`.

## Link project + build APK

From the app folder (already contains `eas.json`):

```powershell
npx eas-cli build:configure
npx eas-cli build -p android --profile preview
```

- First run may ask to create an EAS project — accept defaults.
- Profile `preview` → `android.buildType: apk`, `distribution: internal` (Expo-managed debug/internal credentials, **not** a Play production keystore).
- Wait for the cloud build (~10–20 min). When **Finished**, open the build page.

## Download URL

EAS prints a line like:

`https://expo.dev/accounts/<account>/projects/urgency-road-one/builds/<build-id>`

On that page use **Download** for the `.apk` (direct artifact URL is also shown / available via “Install”).

Install on a phone: enable “Install unknown apps” for the browser/files app, then open the APK.

## Verify profile (already in repo)

`eas.json` → `build.preview`:

- `distribution`: `internal`
- `android.buildType`: `apk`

## What this agent already ran

```text
eas build -p android --profile preview --non-interactive
→ An Expo user account is required to proceed.
  Either log in with eas login or set the EXPO_TOKEN ...
```

No APK URL until you complete login (or provide `EXPO_TOKEN` as a Cursor secret) and re-run the build.
