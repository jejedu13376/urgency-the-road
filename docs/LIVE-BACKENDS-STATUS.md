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
| Multi-IA router | **Heuristique croisée + optional proxy/keys** | `src/services/ai/multiIaRouter.ts` |
| Recalls NHTSA | **LIVE** (free) | `src/services/recalls/nhtsaRecalls.ts` |
| Weather banner | **LIVE Open-Meteo** (cache 10 min) | `src/services/weather/openMeteo.ts` |
| Fil texte | **LIVE Firestore** when Auth | `feedService.ts` |
| Learned failures | **LIVE create** when Auth | `learnedFailuresService.ts` |
| Payments Stripe/RC | **Scaffold** — no fake success | `paymentsService.ts` |
| OBD BLE | **Scaffold + Expo Go limit** | `bleScaffold.ts` |

## Perf / bundle

| Lever | Status |
| --- | --- |
| App icon | Compressed ~393 KB → ~174 KB (`assets/icon.png`) |
| YouTube | TTL cache + `fields` slim + `relevanceLanguage=fr` |
| Firestore | `memoryLocalCache` on init |
| Weather / recalls | In-memory TTL caches |

## Still blocked on client keys / hardware

| Area | Blocker |
| --- | --- |
| Firebase rules on server | Lorenzo: `firebase login` + deploy (see `FIREBASE-DEPLOY.md`) |
| Multi-IA Claude/GPT live | `EXPO_PUBLIC_MULTI_IA_PROXY_URL` or provider keys (prefer proxy) |
| Stripe / PayPal / RC | Checkout / SDK keys |
| OBD hardware DTC | Dev Client + BLE |
| Fil video upload | Storage + moderation |
| GPS graph / weigh live | Maps/traffic APIs |

## Deploy docs

- `docs/FIREBASE-DEPLOY.md` ← exact CLI steps
- `docs/BACKEND-SETUP.md`
- This file + `GLOBAL-SCOPE-STATUS.md`
