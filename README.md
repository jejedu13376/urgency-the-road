# Urgence Mécanique (`urgency-the-road`)

Expo Router (React Native) app — 17 modules: VIN/OBD, Multi-IA, GPS PL, SOS médical, Auth/Firestore, YouTube tutoriels, etc.

**Repo:** `jejedu13376/urgency-the-road` · package `com.axarel.urgencyroadone`  
**Formations:** separate project — do not mix.

## Run (dev)

```bash
cp .env.example .env   # fill EXPO_PUBLIC_* as needed — never commit .env
npm install
npx expo start
```

Typecheck (app only — Cloud Functions excluded from root `tsc`):

```bash
npx tsc --noEmit
cd firebase/functions && npm install && npm run typecheck
```

Press `a` for Android emulator, or scan the QR with **Expo Go**. BLE OBD needs a **Dev Client** (`docs/BLE-DEV-CLIENT.md`).

## Backend / deploy

- Firebase + YouTube setup: [`docs/BACKEND-SETUP.md`](docs/BACKEND-SETUP.md)
- Post-secrets deploy order: [`docs/DEPLOY-CHECKLIST.md`](docs/DEPLOY-CHECKLIST.md)
- Multi-IA proxy: [`docs/MULTI-IA-PROXY.md`](docs/MULTI-IA-PROXY.md)
- Module LIVE vs stub: [`docs/MODULES-STATUS.md`](docs/MODULES-STATUS.md)

Agents do **not** run `firebase deploy` or paste secrets. Lorenzo injects keys / tokens locally or via Cursor Dashboard secrets.

## Build AAB / APK (EAS)

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview      # APK
npx eas-cli build -p android --profile production  # AAB
```

See [`docs/EAS-RUNBOOK.md`](docs/EAS-RUNBOOK.md) and [`docs/apk-build.md`](docs/apk-build.md).

## Google Play Console

[`docs/google-play-console.md`](docs/google-play-console.md)
