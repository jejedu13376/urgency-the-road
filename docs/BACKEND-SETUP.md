# Backend Firebase — Urgence Mécanique (17 modules)

**Codebase:** `/home/ubuntu/Axarel/urgency-road-one` (Expo — do not recreate)  
**Startup password gate:** preserved (`src/security/verifyStartupPassword.ts`)  
**Formations:** untouched

## What shipped (in repo)

| Area | Path |
| --- | --- |
| Env template (placeholders only) | `.env.example` |
| Firebase init + mock detect | `src/firebase/config.ts` |
| Firestore models | `src/types/firestore.ts` |
| Security rules | `firebase/firestore.rules` |
| Indexes | `firebase/firestore.indexes.json` |
| Typed clients (Auth + all collections) | `src/services/firebase/*` |
| Auth context | `src/context/AuthContext.tsx` |
| UI backend banner | `src/components/BackendStatusBanner.tsx` |
| Wired screens | OBD, Urgence/medical, Pro/RDV, Pièces, Garages, Routiers, GPS/hazards, Tutoriels/YouTube, Compte/Auth, Menu |

### Collections modeled

`users`, `vehicles`, `parts`, `obdReadings` (OBD2 + J1939/J1708), `garages`, `medicalCards` (rescuer + `subscriptionActive` gate in rules), `roadHazards`, `gpsPrefs`, `weighStations`, `quotes`, `insuranceClaims`, `garageRatings`, `appointments` (M17), `youtubeSuggestions` (URL stubs only), plus `learnedFailures` / `feedPosts` in rules.

### Behaviour without config

If `EXPO_PUBLIC_FIREBASE_*` are empty → **mock fallback** on every service (`source: 'mock'` + stub label). App remains usable offline for demos. Gate still runs first.

---

## Client-only steps (you must do these)

### 1) Create Firebase project

1. Open https://console.firebase.google.com/ → **Add project** (e.g. `urgence-mecanique`).
2. Disable Google Analytics or enable as you prefer.
3. In the project: **Build → Authentication → Get started → Email/Password → Enable**.
4. **Build → Firestore Database → Create database** (start in **production** mode, then deploy rules below).
5. Pick a region close to users (e.g. `europe-west`).

### 2) Register the Expo / Web app & copy keys

1. Project settings → **Your apps** → Web (`</>`).
2. Register app nickname `urgency-road-one`.
3. Copy the config object into a local `.env` (never commit secrets beyond the public web config — these `EXPO_PUBLIC_` values are client-visible by design):

```bash
cd Axarel/urgency-road-one
cp .env.example .env
# fill EXPO_PUBLIC_FIREBASE_* from the Firebase console
```

4. Restart Expo (`npx expo start -c`) so Metro picks up env vars.

### 3) Billing

- **Spark (free)** is enough to start Auth + Firestore low traffic.
- Enable **Blaze** only when you need Cloud Functions, higher quotas, or paid Google APIs (Maps, etc.).
- Set budget alerts in Google Cloud Billing linked to the Firebase project.

### 4) Deploy rules & indexes (prod)

On a machine with Firebase CLI logged in as the project owner:

```bash
cd Axarel/urgency-road-one
npm i -g firebase-tools
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

Files used: `firebase/firebase.json`, `firebase/firestore.rules`, `firebase/firestore.indexes.json`.

### 5) Seed / admin roles

- First user signs up via Module 15 → `users/{uid}` with `role: user`.
- Promote garages / rescuers / admins **only** from Firebase Console or an Admin SDK script (rules block clients from self-escalating `role` / `subscription`).
- For medical scan tests: set a user to `role: rescuer`, `subscription: rescuer`, `subscriptionActive: true`.

### 6) Physical OBD (Module 5)

Not included in this backend pass. To go live later:

1. Choose a BLE OBD-II / heavy-duty adapter (ELM327 class for OBD2; J1939 needs a compatible truck dongle).
2. Add a native BLE library (e.g. `react-native-ble-plx` via Expo config plugin / dev client — **not** Expo Go).
3. Parse PIDs / DM1 into `obdReadings` via `readObdSnapshot` (replace mock payload).
4. Keep mock fallback when no adapter is bonded.

### 7) YouTube (Modules 6 / 11)

Only **search/result URLs** are stored/suggested — **no embedded video files**. Optional: Cloud Function calling YouTube Data API (needs API key on server, not in `EXPO_PUBLIC_`).

### 8) Payments (Module 15)

Lydia / Stripe / Apple Pay / Google Pay remain stubs. Wire Stripe Checkout or RevenueCat after Auth is live; keep payment secrets server-side.

---

## Module → service map

| M | Service entrypoints |
| --- | --- |
| 1–2 | `vehiclesService` (`listVehicles`, `upsertVehicle`, `decodeVinRemote`) |
| 3 | `partsService`, `quotesService` |
| 4 | still UI + `stubs` AI (no Firebase model required yet) |
| 5 | `obdService` |
| 6 / 11 | `youtubeService` (+ speech local) |
| 7 | `gpsService`, `hazardsService` |
| 8 | `weighService` |
| 9 | `garagesService` (+ ratings) |
| 10 | local entretien UI; claims via `insuranceService` |
| 12 | rules for `feedPosts` (UI still mock feed) |
| 13 | `medicalService` + SOS UI |
| 14 | rules `learnedFailures` |
| 15 | `authService` + payment stub |
| 16 | Share API (no Firestore) |
| 17 | `appointmentsService` + Pro/Admin UI |

---

## Verify locally

```bash
cd /home/ubuntu/Axarel/urgency-road-one
npm install
npx tsc --noEmit
npx expo start
```

Without `.env` → yellow **MOCK — Firebase non configuré**. With filled `.env` → green **Firebase configuré** (after Auth/Firestore enabled).
