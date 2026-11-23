# Hosting restore — Urgence Mécanique / urgency-road-one

Repo GitHub (source of truth after PR #1): **`jejedu13376/urgency-the-road`**  
App slug Expo: `urgency-road-one`

Formations: **STANDBY — do not touch.**

## What “hosting” means here

| Channel | Use | Status |
| --- | --- | --- |
| Expo Go / `npx expo start` | Dev & demos | Primary local |
| EAS Build (preview APK / production AAB) | Installable Android | Needs Expo login / `EXPO_TOKEN` |
| EAS Update (OTA JS) | Fast JS updates without store | Optional after first native build |
| Cursor `publish-app` | Web publish proposal | User must confirm in Cursor UI |
| Netlify Drop / Vercel temp | Static web only | Not a substitute for native BLE |

## If Expo / store publish looks broken — Lorenzo clicks

### A) Local Expo (fastest check)

```bash
cd urgency-the-road   # or Axarel/urgency-road-one checkout
npm install
npx expo start -c
```

- Phone: Expo Go → scan QR  
- Web: press `w`  
- If Metro fails: delete `.expo` + `npx expo start -c`

### B) EAS preview APK (downloadable test)

1. https://expo.dev/signup (free)  
2. `npx eas-cli login`  
3. `npx eas-cli build:configure` (accept project link to this repo)  
4. `npx eas-cli build -p android --profile preview`  
5. Open finished build page → **Download** `.apk`

Profile `preview` = APK, internal creds (no Play production keystore).

### C) Development Client (required for **live BLE OBD**)

Expo Go cannot load `react-native-ble-plx`.

```bash
npm i react-native-ble-plx
npx eas-cli build -p android --profile development
```

Install the Dev Client APK → `npx expo start --dev-client` → Module 5 Scan/Connect.

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

- Expo account login / claim EAS build  
- Cursor publish confirmation dialog  
- Google Play Console payment / listing  
- Granting GitHub App access if a second repo name is used  

## Smoke after restore

1. Startup gate password screen  
2. Red top-left spinner visible on gate + after unlock  
3. Menu → Module 5 OBD → scan UI  
4. Firebase/YouTube banners show configured vs mock
