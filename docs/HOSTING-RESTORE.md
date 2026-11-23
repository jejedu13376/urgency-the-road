# Hosting restore — Urgence Mécanique / urgency-road-one

Repo GitHub (source of truth): **`jejedu13376/urgency-the-road`**  
App slug Expo: `urgency-road-one`  
Android package: `com.axarel.urgencyroadone`

Formations: **STANDBY — do not touch.**

## Download links (status)

| Link | Purpose | Status |
| --- | --- | --- |
| **Provisional** → https://github.com/jejedu13376/urgency-the-road/releases | Placeholder until first EAS APK | Ready (empty Releases until Lorenzo uploads / EAS finishes) |
| **Repo** → https://github.com/jejedu13376/urgency-the-road | Source + install docs | Live |
| **EAS preview APK** → `https://expo.dev/accounts/<account>/projects/urgency-road-one/builds/<id>` | Installable Android test APK | **Blocked** — needs Expo login / `EXPO_TOKEN` (see `docs/EAS-RUNBOOK.md`) |
| Cursor `publish-app` (web) | Hosted web shell | User must confirm in Cursor Publish dialog |

## What “hosting” means here

| Channel | Use | Status |
| --- | --- | --- |
| Expo Go / `npx expo start` | Dev & demos (no live BLE) | Primary local |
| EAS Build **preview** APK | Installable Android (no Play keystore) | Needs Expo login / `EXPO_TOKEN` |
| EAS Build **development** Dev Client | Live BLE OBD (`react-native-ble-plx`) | Needs Expo login + Dev Client install |
| EAS Update (OTA JS) | Fast JS updates without store | Optional after first native build |
| Cursor `publish-app` | Web publish proposal | User must confirm in Cursor UI |
| Netlify Drop / Vercel temp | Static web only | Not a substitute for native BLE |

## Config already in repo

- `eas.json` — profiles `development` (Dev Client APK), `preview` (APK), `production` (AAB)
- `app.json` — Android package, BLE permissions, `expo-dev-client` + `react-native-ble-plx` plugins
- Dependencies: `expo-dev-client`, `react-native-ble-plx` (soft-required in `src/services/obd/bleScaffold.ts`)
- `extra.eas.projectId` / `owner` stay `null` until first `eas build:configure` after login

## If Expo / store publish looks broken — Lorenzo clicks

### A) Local Expo (fastest check)

```bash
cd urgency-the-road
npm install
npx expo start -c
```

- Phone: Expo Go → scan QR (BLE remains mock / capability false)
- Web: press `w`
- If Metro fails: delete `.expo` + `npx expo start -c`

### B) EAS preview APK (downloadable test) — preferred finish link

Full click-by-click: **`docs/EAS-RUNBOOK.md`**.

```bash
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build -p android --profile preview
```

Profile `preview` = APK, internal creds (no Play production keystore).

### C) Development Client (required for **live BLE OBD**)

Expo Go cannot load native `react-native-ble-plx` BLE hardware APIs.

```bash
npx eas-cli build -p android --profile development
# install the Dev Client APK on the phone
npx expo start --dev-client
```

Then Module 5 → Scan/Connect with a physical ELM327 / J1939 dongle.

See **`docs/BLE-DEV-CLIENT.md`**.

### D) Cursor publish-app (web)

1. Agent proposes publish (Publish button on the chat).
2. Lorenzo opens publish dialog → pick **public** (or private/team) → confirm slug.
3. No public URL until that click — agent cannot invent the link.

### E) Play Store

See `docs/google-play-console.md` — $25 one-time, then upload AAB from `eas build -p android --profile production`.

## Env keys that unblock “live” hosting backends

Copy `.env.example` → `.env` (never commit secrets):

- `EXPO_PUBLIC_FIREBASE_*` — Auth/Firestore
- `EXPO_PUBLIC_YOUTUBE_API_KEY` — tutoriel search
- Optional pay bases — see `BACKEND-SETUP.md`

Then `npx expo start -c`.

## Blockers this agent cannot click for you

- Expo account login / claim EAS build (`EXPO_TOKEN` as Cursor **Cloud Agent / environment** secret — not `EXPO_PUBLIC_*`)
- Cursor publish confirmation dialog
- Google Play Console payment / listing
- Filling `extra.eas.projectId` (created on first successful `eas build:configure`)

## Smoke after restore

1. Startup gate password screen
2. Red top-left spinner visible on gate + after unlock
3. Menu → Module 5 OBD → scan UI
4. Firebase/YouTube banners show configured vs mock
5. On Dev Client only: BLE capability true + real scan
