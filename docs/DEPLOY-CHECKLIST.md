# Deploy checklist — Urgency Road (Lorenzo)

**Status (2026-11-23 ~4:27 PM America/Edmonton):**  
- `EXPO_TOKEN` → **OK** on cloud VM (`whoami` = `jejedu13376`); preview APK **FINISHED** (`e36fd307`)  
- `functions:multiIa` → **LIVE** at `https://us-central1-urgency-road.cloudfunctions.net/multiIa`  
- Remaining user paste: `EXPO_PUBLIC_MULTI_IA_PROXY_URL` (+ optional `EXPO_PUBLIC_INSTALL_URL`) in local `.env`  
- Provider LLM keys still server-side as needed — see `docs/MULTI-IA-PROXY.md`  
**Repo:** `jejedu13376/urgency-the-road` · project id `urgency-road` · config `firebase/firebase.json`  
**Formations:** standby — do not touch.  
**Never paste secret values into chat or commit them.**

Canonical in GitHub: `docs/DEPLOY-CHECKLIST.md`. Store mirror: `docs/urgency-road-one/DEPLOY-CHECKLIST.md`.

---

## 0) Preconditions

- [ ] On a machine with Firebase CLI auth (`firebase login` **or** `export FIREBASE_TOKEN=…`)
- [ ] Multi-IA provider keys ready to set on the function (only the engines you use):  
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`  
  → details: `docs/MULTI-IA-PROXY.md`
- [x] Expo auth ready: Cursor secret `EXPO_TOKEN` valid (`eas whoami` → `jejedu13376`)  
  → details: `docs/EAS-RUNBOOK.md` · APK `e36fd307` already built

```bash
cd /path/to/urgency-the-road
git pull origin main
```

---

## 1) Firebase — rules + indexes + functions

`firebase/firebase.json` has **firestore** + **functions** only. There is **no** Firebase Hosting target — skip `--only hosting`. Installable “hosting” = EAS APK / Expo (`docs/HOSTING-RESTORE.md`).

```bash
cd /path/to/urgency-the-road
cd firebase/functions && npm install && npm run build && cd ../..

# Rules + indexes + Multi-IA proxy (one shot)
firebase deploy --config firebase/firebase.json \
  --only firestore:rules,firestore:indexes,functions:multiIa \
  --project urgency-road
```

Or split:

```bash
firebase deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes --project urgency-road
firebase deploy --config firebase/firebase.json --only functions:multiIa --project urgency-road
```

Set provider secrets on the function (Console env/Secrets **or** `firebase functions:secrets:set …`) — names only above; see `docs/MULTI-IA-PROXY.md`.

---

## 2) App `.env` — Multi-IA proxy URL

**multiIa is already live.** Lorenzo — paste this **exact** line into root `.env`  
(Windows: `C:\Users\Jejedou13376\urgency-the-road\.env`):

```bash
EXPO_PUBLIC_MULTI_IA_PROXY_URL=https://us-central1-urgency-road.cloudfunctions.net/multiIa
```

URL is public (not a secret). Do **not** put provider API keys in any `EXPO_PUBLIC_*` var.  
`bind-app-secrets` refuses `EXPO_PUBLIC_*` — Dashboard secret and/or local `.env` only.

```bash
npx expo start -c
```

---

## 3) EAS APK (installable build)

```bash
npx eas-cli whoami          # must be logged in (or EXPO_TOKEN set)
npx eas-cli build:configure # first time only — commit projectId/owner when written
npx eas-cli build -p android --profile preview
```

When the build finishes, grab the Expo build / download URL.

---

## 4) App `.env` — install / share URL (Module 16)

```bash
EXPO_PUBLIC_INSTALL_URL=https://expo.dev/accounts/<account>/projects/urgency-road-one/builds/<build-id>
# or a GitHub Release asset URL once uploaded
```

Restart Expo: `npx expo start -c`.

Optional: upload the `.apk` to https://github.com/jejedu13376/urgency-the-road/releases so the provisional Releases link becomes a real binary.

---

## 5) Smoke

| Check | Expected |
| --- | --- |
| Firestore Console → Rules | Latest publish time |
| `GET` Multi-IA proxy URL | `{ ok: … }` health (no secrets) |
| Module 15 sign-in | Auth + owner writes OK |
| Module 6 live vote (signed-in) | Proxy engines respond when keys set |
| Module 16 partage | Shows LIVE install URL from `.env` |

---

## Related docs

- `docs/FIREBASE-DEPLOY.md` — auth / CI token / ADC
- `docs/MULTI-IA-PROXY.md` — proxy secrets + contract
- `docs/EAS-RUNBOOK.md` — Expo login / APK paths
- `docs/HOSTING-RESTORE.md` — Expo/EAS channels (not Firebase Hosting)
- `docs/BACKEND-SETUP.md` — Firebase + YouTube console setup
- Store mirror: `/cursor/stores/self/docs/urgency-road-one/DEPLOY-CHECKLIST.md`
