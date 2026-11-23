# Live backends status — Urgency Road

Updated continuously. **Formations: never touched.**

## Connected / shipped in code

| Area | Status | Path |
| --- | --- | --- |
| VIN NHTSA vPIC | **LIVE** (free, no key) | `src/services/vin/nhtsaDecode.ts` |
| VIN camera scan | **LIVE** (expo-camera barcode) | `src/components/VinCameraScanner.tsx` |
| Firebase Auth/Firestore | **LIVE when `.env` set** | `src/firebase/config.ts` + services |
| Firestore rules | **In repo** — Lorenzo deploys | `docs/FIREBASE-DEPLOY.md` |
| YouTube search | **LIVE + 15 min cache** | `youtubeSearch.ts` |
| Multi-IA router | **Heuristique + optional SERVER proxy only** (no client LLM keys) | `src/services/ai/multiIaRouter.ts` |
| Recalls NHTSA | **LIVE** (free) | `src/services/recalls/nhtsaRecalls.ts` |
| Weather banner | **LIVE Open-Meteo** (cache 10 min) | `src/services/weather/openMeteo.ts` |
| Fil texte | **LIVE Firestore** when Auth | `feedService.ts` |
| Learned failures | **Owner-only** (no public read; no VIN field) | `learnedFailuresService.ts` |
| Payments Stripe/RC | **Scaffold** — no fake success | `paymentsService.ts` |
| OBD BLE | **Live path coded** (ELM327 AT + PID/DTC) — needs Dev Client + dongle | `bleScaffold.ts` + `bleSession.ts` + `elm327Protocol.ts` |
| Red top-left spinner | Kept (also on gate) | `PermanentLeftSpinner.tsx` |
| Startup gate | Kept (session-only) | `StartupGate*` |
| Hosting restore | Docs | `docs/HOSTING-RESTORE.md` |

## Perf / bundle

| Lever | Status |
| --- | --- |
| App icon | Compressed (`assets/icon.png`) |
| YouTube | TTL cache + `fields` slim + `relevanceLanguage=fr` + 6s abort |
| Firestore | `memoryLocalCache` on init |
| Weather / recalls | In-memory TTL caches |

## Still blocked on client keys / hardware

| Area | Blocker |
| --- | --- |
| Firebase rules on server | Lorenzo: `firebase login` + deploy (see `FIREBASE-DEPLOY.md`) |
| Multi-IA Claude/GPT live | Server proxy + provider keys **server-side only** (`EXPO_PUBLIC_MULTI_IA_PROXY_URL`) |
| Stripe / PayPal / RC | Checkout / SDK keys |
| OBD hardware DTC | Dev Client + BLE |
| Fil video upload | Storage + moderation |
| GPS graph / weigh live | Maps/traffic APIs |

## Deploy docs

- `docs/FIREBASE-DEPLOY.md` ← exact CLI steps
- `docs/BACKEND-SETUP.md`
- This file + `GLOBAL-SCOPE-STATUS.md`
