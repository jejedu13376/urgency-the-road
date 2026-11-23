# EAS Android preview / Dev Client — click-by-click (Lorenzo)

**Goal:** a real downloadable Android APK URL for Urgence Mécanique (`urgency-road-one`).

**Cloud agent status (2026-11-23):** `eas-cli whoami` → **Not logged in**. No `EXPO_TOKEN` on the VM. Config is ready; build is blocked on Expo auth.

---

## Provisional download link (until EAS finishes)

**https://github.com/jejedu13376/urgency-the-road/releases**

Use this as the stand-in app download link. After the first successful `preview` build, replace it with the Expo build page (or attach the `.apk` as a GitHub Release asset).

Repo fallback: https://github.com/jejedu13376/urgency-the-road

---

## Missing for a real EAS APK

1. Free Expo account (or login to existing)
2. Either interactive `eas login` **or** Cursor Cloud Agent secret `EXPO_TOKEN`
3. One successful `eas build -p android --profile preview` (fills `extra.eas.projectId` + `owner` in `app.json`)

---

## Path A — local PC (interactive, free Expo)

### 1) Create / open Expo account

1. Open https://expo.dev/signup  
2. Sign up with email, GitHub, or Google (free tier is enough for preview APK)

### 2) Login on the machine with the repo

```powershell
cd /path/to/urgency-the-road
# or: git clone https://github.com/jejedu13376/urgency-the-road.git && cd urgency-the-road
npm install
npx eas-cli login
npx eas-cli whoami
```

Complete the browser / device prompt until `whoami` prints your username.

### 3) Link the EAS project (first time only)

```powershell
npx eas-cli build:configure
```

- Accept creating/linking project **urgency-road-one**
- This writes `expo.extra.eas.projectId` and usually `expo.owner` into `app.json`
- Commit those two fields when they appear (do **not** leave secrets in git)

### 4) Build the preview APK

```powershell
npx eas-cli build -p android --profile preview
# npm script (uses the `eas` binary from the eas-cli package):
npm run eas:preview:android
```

- First Android build: accept **Expo-managed credentials** / generate new keystore when asked  
- Wait ~10–20 minutes for **Finished**

### 5) Get the download URL

EAS prints a page like:

```text
https://expo.dev/accounts/<your-account>/projects/urgency-road-one/builds/<build-id>
```

On that page → **Download** / **Install** → `.apk`.

Optional: upload that APK to https://github.com/jejedu13376/urgency-the-road/releases so the provisional Releases URL becomes a real binary.

### 6) Install on phone

1. Enable **Install unknown apps** for the browser/Files app  
2. Open the APK → install  
3. Launch **Urgence Mécanique** → gate password → smoke Module 5

---

## Path B — Cloud agent (non-interactive) via `EXPO_TOKEN`

1. https://expo.dev → Account → Settings → **Access tokens** → Create token  
2. In Cursor Dashboard → Cloud Agents → Secrets (or this Project environment secrets) → add **`EXPO_TOKEN`** = that token  
   - Not an app `EXPO_PUBLIC_*` secret (those names are reserved / wrong for EAS CLI)  
3. Re-run the hosting agent / ask it to execute:

```bash
npx eas-cli whoami
npx eas-cli build:configure --non-interactive
npx eas-cli build -p android --profile preview --non-interactive
```

4. Paste the finished build URL into chat / SUIVI.

---

## Dev Client build (live BLE)

Preview APK is production-like JS **without** requiring a Metro server, but **live BLE** needs the **development** profile (includes `expo-dev-client` + native `react-native-ble-plx`).

```powershell
npx eas-cli build -p android --profile development
# or npm script (bin = `eas`, not `eas-cli`):
npm run eas:devclient:android
```

Then:

```powershell
npx expo start --dev-client
```

Details: `docs/BLE-DEV-CLIENT.md`.

---

## npm scripts note

`package.json` `eas:*` scripts invoke the **`eas`** binary (provided by the `eas-cli` npm package). Do not call a nonexistent `eas-cli` binary from scripts; `npx eas-cli …` is fine for one-off CLI.

## Verify profiles (already committed)

`eas.json`:

| Profile | What you get |
| --- | --- |
| `development` | Dev Client + APK + internal distribution |
| `preview` | Standalone-ish APK + internal (no Play keystore) |
| `production` | AAB for Play Store |

`app.json` already has Android BLE permissions + `react-native-ble-plx` / `expo-dev-client` plugins.

---

## What the cloud agent already ran

```text
npx eas-cli whoami
→ Not logged in

(expected after login)
npx eas-cli build -p android --profile preview --non-interactive
→ An Expo user account is required to proceed.
  Either log in with eas login or set the EXPO_TOKEN ...
```

No APK artifact URL until Path A or Path B completes.
