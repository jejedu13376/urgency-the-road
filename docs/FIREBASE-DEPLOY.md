# Deploy Firestore rules — Urgence Mécanique (Lorenzo)

**Repo path:** `firebase/firestore.rules` (+ `firestore.indexes.json`)  
**Config:** `firebase/firebase.json`  
**Project id:** from your `.env` → `EXPO_PUBLIC_FIREBASE_PROJECT_ID` (also mirrored as `firebase/.firebaserc`)  
**Formations:** never deploy from that project.

Cloud agents usually **cannot** complete `firebase login` (no browser). Lorenzo runs these steps once on a machine with Firebase CLI access.

---

## Exact steps

### 1. Install CLI (once)

```bash
npm i -g firebase-tools
firebase --version
```

### 2. Login (interactive — required)

```bash
firebase login
```

Opens a browser → sign in with the Google account that owns the Firebase project.

### Headless / CI alternatives (pick one)

**A — CI token (recommended for agents / GitHub Actions)**

On Lorenzo’s machine (browser once):

```bash
firebase login:ci
# Copy the printed token into CI secrets as FIREBASE_TOKEN (never commit it)
```

Then in CI / cloud agent env:

```bash
export FIREBASE_TOKEN="<from-login:ci>"
firebase deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes --project urgency-road --non-interactive
```

**B — Service account (GCP ADC)**

```bash
# Create a service account JSON in GCP → IAM → Service accounts (Firebase Admin / Editor)
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json
firebase deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes --project urgency-road --non-interactive
```

### Cloud-agent attempts (2026-11-23)

Ran twice from `jejedu13376/urgency-the-road` → project **`urgency-road`** (`--only firestore:rules,firestore:indexes`):

```text
Error: Failed to authenticate, have you run firebase login?
Could not load the default credentials.
```

`firebase login:list` on the agent VM: **No authorized accounts**. Empty `FIREBASE_TOKEN`, unset `GOOGLE_APPLICATION_CREDENTIALS`, no Cursor secrets.

**Important:** `firebase login` on Lorenzo’s laptop does **not** authenticate the cloud agent. After local login succeeds, Lorenzo must run the deploy **on that same machine** (or inject **A** / **B** into the agent env).

```bash
# On the machine where `firebase login` already succeeded:
cd /path/to/urgency-the-road
firebase deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes --project urgency-road
```

### 3. Select project

```bash
cd /path/to/urgency-road-one   # or Axarel / store clone
# Option A — use .firebaserc
firebase use

# Option B — set from .env project id
firebase use "$(grep '^EXPO_PUBLIC_FIREBASE_PROJECT_ID=' .env | cut -d= -f2)"
```

### 4. Deploy rules + indexes only

```bash
firebase deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes
```

Success looks like:

```text
✔  Deploy complete!
Project Console: https://console.firebase.google.com/project/<project-id>/overview
```

### 5. Verify in Console

1. Firebase Console → **Firestore** → **Rules** → confirm latest publish time.
2. **Indexes** → composite indexes from `firestore.indexes.json` show as Enabled (or Building).

### 6. App check

```bash
npx expo start -c
```

Sign in (Module 15) → save medical fiche / vehicle → no permission-denied on owner paths.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Failed to authenticate` | Re-run `firebase login` or refresh service account |
| `Permission denied` on deploy | Your Google account needs Owner/Editor on the GCP project |
| Rules deploy but app denied | Confirm `.env` `EXPO_PUBLIC_FIREBASE_PROJECT_ID` matches `firebase use` |
| Indexes still Building | Wait; queries needing them fail until Enabled |

**Do not** commit service-account JSON or `.env` secrets.

## Multi-IA keys (Lorenzo) — server only

Never put OpenAI / Anthropic / Gemini / Grok / Mistral / DeepSeek keys in `EXPO_PUBLIC_*` (they ship in the app bundle).

1. Deploy a Cloud Function / backend that holds the provider keys.
2. Set only `EXPO_PUBLIC_MULTI_IA_PROXY_URL` in the app `.env`.
3. Proxy should verify the Firebase ID token from `Authorization: Bearer <idToken>` when present.
