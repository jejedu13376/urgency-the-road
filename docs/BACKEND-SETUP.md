# Backend setup — Urgence Mécanique (Lorenzo)

**Project:** `/home/ubuntu/Axarel/urgency-road-one` (mirror: `/cursor/stores/self/urgency-road-one/`)  
**Formations:** untouched — separate project.  
**Code is already wired.** Once you paste keys into `.env` and restart Expo, Auth / Firestore / YouTube connect **without further code changes**.

---

## A) Exact steps — Firebase Auth + Firestore

### 1. Create the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) → **Add project** (name e.g. `urgency-road`).
2. Google Analytics: optional.
3. Open the new project.

### 2. Enable Authentication (Email/Password)

1. Left menu → **Build → Authentication** → **Get started**.
2. **Sign-in method** → **Email/Password** → **Enable** → Save.

### 3. Create Firestore

1. **Build → Firestore Database** → **Create database**.
2. Start in **production** mode (rules are in `firebase/firestore.rules`).
3. Choose a region (e.g. `europe-west1`).

### 4. Register a Web app and copy keys

1. Gear → **Project settings** → **Your apps** → **Add app** → **Web** (`</>`).
2. Nickname: `urgency-road-one` → Register.
3. Copy the `firebaseConfig` fields into `.env` (see mapping below).

### 5. Paste into `.env` (placeholders only in repo)

```bash
cd /home/ubuntu/Axarel/urgency-road-one   # or your Windows store path
cp .env.example .env
```

Fill **only** these (leave empty in git; never commit real values):

| Firebase console field | `.env` variable |
| --- | --- |
| `apiKey` | `EXPO_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `EXPO_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `EXPO_PUBLIC_FIREBASE_APP_ID` |
| `measurementId` (optional) | `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` |

### 6. Deploy rules (once CLI is installed)

```bash
cd /home/ubuntu/Axarel/urgency-road-one
npm i -g firebase-tools
firebase login
firebase use <your-project-id>
firebase deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes
```

### 7. Restart the app

```bash
npx expo start -c
```

Banner should show **Firebase configuré**. Module 15 → S’inscrire / Connexion uses live Auth. Empty `.env` → mock fallback (no crash).

**Code path (already live):** `src/firebase/config.ts` → `getFirebase()` / `isFirebaseConfigured()` → `src/services/firebase/authService.ts` + all `*Service.ts`.

---

## B) Exact steps — YouTube Data API key

### 1. Enable the API

1. [Google Cloud Console](https://console.cloud.google.com/) → same GCP project as Firebase (or a dedicated one).
2. **APIs & Services → Library** → **YouTube Data API v3** → **Enable**.

### 2. Create + restrict the key

1. **APIs & Services → Credentials → Create credentials → API key**.
2. Restrict immediately:
   - **Application restrictions:** HTTP referrers and/or Android/iOS as needed.
   - **API restrictions:** **YouTube Data API v3** only.
3. Save.

### 3. Paste into `.env`

Same variable as `docs/ENV-YOUTUBE.env` / store `ENV-YOUTUBE.env`:

```bash
EXPO_PUBLIC_YOUTUBE_API_KEY=
```

Or copy:

```bash
# from store docs helper
# EXPO_PUBLIC_YOUTUBE_API_KEY=<paste>
```

Restart: `npx expo start -c`. Banner shows **YouTube API clé OK**. Modules 6 / 11 call `search.list` and open `youtube.com/watch?v=…` (no embedded files).

**Code path (already live):** `src/services/youtube/youtubeSearch.ts` ← `EXPO_PUBLIC_YOUTUBE_API_KEY` ← `src/services/firebase/youtubeService.ts` (`suggestYoutube`) ← `YoutubeSuggestions` UI.

Without the key → fallback YouTube **search results URL** only (no fake video embed).

---

## C) Verify checklist

| Check | Expected |
| --- | --- |
| `.env` exists, gitignored | Yes (`.gitignore` has `.env`) |
| `.env.example` | Placeholders empty only |
| Banner without keys | MOCK Firebase · YouTube manquant |
| Banner with Firebase keys | Firebase configuré |
| Banner with YouTube key | YouTube API clé OK |
| Module 15 signup | Creates Auth user + `users/{uid}` when Firebase live |
| Module 11 tutoriels | Live video titles when YouTube key set |

---

## D) Optional later

- Payments: `EXPO_PUBLIC_STRIPE_CHECKOUT_BASE` / `EXPO_PUBLIC_PAYPAL_CHECKOUT_BASE` (Module 15).
- OBD BLE: Dev Client + `react-native-ble-plx` (Module 5).
- Prefer moving YouTube key to a Cloud Function before production scale.

**Formations:** do not touch.
