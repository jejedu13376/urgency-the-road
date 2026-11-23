# Live backends status — Urgency Road

Updated continuously. **Formations: never touched.**

## Connected / shipped in code

| Area | Status | Path |
| --- | --- | --- |
| VIN NHTSA vPIC | **LIVE** (free, no key) | `src/services/vin/nhtsaDecode.ts` → `decodeVinRemote` |
| VIN camera scan | **LIVE** (expo-camera barcode) | `src/components/VinCameraScanner.tsx` |
| VIN mock fallback | OK if NHTSA fails | `mockDecodeVin` |
| Firebase Auth/Firestore | **LIVE when `.env` set** | `src/firebase/config.ts` + `authService` |
| Firestore rules | **In repo** — deploy client-side | `firebase/firestore.rules` |
| YouTube search | **LIVE when `EXPO_PUBLIC_YOUTUBE_API_KEY`** | `youtubeSearch.ts` |
| Payments Stripe/RC | **Scaffold** — no fake success | `paymentsService.ts` |
| OBD BLE | **Scaffold + Expo Go limit documented** | `bleScaffold.ts` |
| Red top-left spinner | Kept | `PermanentLeftSpinner.tsx` |
| Startup gate | Kept | `StartupGate*` |

## Still blocked on client keys / hardware

| Area | Blocker |
| --- | --- |
| Firebase live reads/writes | Fill `.env` + enable Auth/Firestore + `firebase deploy` rules |
| YouTube API results | Restricted `EXPO_PUBLIC_YOUTUBE_API_KEY` or Cloud Function |
| Stripe checkout open | `EXPO_PUBLIC_STRIPE_CHECKOUT_BASE` |
| RevenueCat IAP | Dev Client + `react-native-purchases` + public SDK key |
| OBD hardware DTC | Dev Client + `react-native-ble-plx` + ELM327/J1939 dongle |
| Multi-IA Claude/GPT/… | Provider API keys (server) |
| GPS graph / live weigh | Maps/traffic APIs |
| Fil video upload | Storage + moderation backend |
| Apple / Google Pay | Stripe Checkout wallets or RevenueCat + Dev Client |
| PayPal | EXPO_PUBLIC_PAYPAL_CHECKOUT_BASE |
| Stripe cartes | EXPO_PUBLIC_STRIPE_CHECKOUT_BASE |

## Deploy docs

- `docs/BACKEND-SETUP.md`
- `docs/FIREBASE-DEPLOY.md`
- This file + `GLOBAL-SCOPE-STATUS.md`

## Firebase + YouTube (env-only, ready for Lorenzo)

| Backend | Env vars | Status |
| --- | --- | --- |
| Firebase Auth + Firestore | `EXPO_PUBLIC_FIREBASE_*` (7 keys in `.env.example`) | Wired in `src/firebase/config.ts` → auth/vehicles/medical/… services. Mock fallback until keys pasted. |
| YouTube Data API v3 | `EXPO_PUBLIC_YOUTUBE_API_KEY` (`docs/ENV-YOUTUBE.env`) | Wired in `src/services/youtube/youtubeSearch.ts` → `youtubeService.suggestYoutube`. Fallback search URL without key. |

**Lorenzo steps:** `/cursor/stores/self/docs/urgency-road-one/BACKEND-SETUP.md` — create Firebase project, enable Auth + Firestore, paste keys, create YouTube API key, `npx expo start -c`. No further code changes.

