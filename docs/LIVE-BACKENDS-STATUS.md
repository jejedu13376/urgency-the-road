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
| Multi-IA router | **Heuristique + SERVER proxy** (Firebase `multiIa` in repo; deploy = Lorenzo) | `src/services/ai/multiIaRouter.ts` + `firebase/functions/` |
| Recalls NHTSA | **LIVE** (free) | `src/services/recalls/nhtsaRecalls.ts` |
| Weather banner | **LIVE Open-Meteo** (cache 10 min) | `src/services/weather/openMeteo.ts` |
| Geocode destination (forward) | **LIVE Open-Meteo** | `src/services/geo/openMeteoGeocode.ts` |
| Reverse geocode | **LIVE Photon only** (#18) | `src/services/geo/` (Photon reverse) |
| Device GPS | **LIVE expo-location** (Lille fallback opt-in for discovery; **M13 SOS refuses fallback**) | `src/services/geo/deviceLocation.ts` |
| Garages / pièces around me | **LIVE Overpass OSM** (+ Firestore/mock fallback) | `overpassPlaces.ts` + `garagesService.ts` |
| Weigh / dépôts PL | **LIVE Overpass OSM** (ON/OFF unknown if untagged) | `weighService.ts` |
| Parts list by VIN | **Local WMI catalogue** (+ Firestore if filled) | `vinPartsCatalog.ts` |
| Carnet export | **Share texte LIVE** (not certified PDF) | `exportCarnet.ts` |
| Fil texte | **LIVE Firestore** when Auth | `feedService.ts` |
| Learned failures | **Owner-only** (no public read; no VIN field) | `learnedFailuresService.ts` |
| Payments Stripe/RC | **Scaffold** — no fake success | `paymentsService.ts` |
| OBD BLE | **Live path coded** (ELM327 AT + PID/DTC) — needs Dev Client + dongle | `bleScaffold.ts` + `bleSession.ts` + `elm327Protocol.ts` |
| Red top-left spinner | Removed | Was `PermanentLeftSpinner.tsx` (deleted) |
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
| Multi-IA Claude/GPT live | Deploy `functions:multiIa` + provider secrets (`docs/MULTI-IA-PROXY.md`) + `EXPO_PUBLIC_MULTI_IA_PROXY_URL` |
| Stripe / PayPal / RC | Checkout / SDK keys |
| OBD hardware DTC | Dev Client + BLE |
| Fil video upload | Storage + moderation |
| PTAC / legal clearance graph | Commercial truck routing API (free: Valhalla `truck` + OSM maxheight advisory — not a paid PTAC product) |
| Weigh ON/OFF realtime | Jurisdiction feeds (OSM rarely tagged) |
| Certified PDF carnet | Signed PDF backend |
| Install URL prod | `EXPO_PUBLIC_INSTALL_URL` |

## Deploy docs

- `docs/DEPLOY-CHECKLIST.md` ← post-secrets order (**blocked** on `FIREBASE_TOKEN` / Multi-IA / `EXPO_TOKEN`)
- `docs/urgency-road-one/SUIVI.md` ← tonight / secrets / modules
- `docs/FIREBASE-DEPLOY.md` ← exact CLI steps
- `docs/MULTI-IA-PROXY.md` ← Multi-IA Cloud Function + secrets
- `docs/BACKEND-SETUP.md` · `docs/urgency-road-one/FIREBASE-CDN.md`
- This file + `GLOBAL-SCOPE-STATUS.md` · `MODULES-STATUS.md`
