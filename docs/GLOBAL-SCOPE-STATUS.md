# GLOBAL SCOPE STATUS — Urgency Road (17 modules)

**Scope:** Urgency Road ONLY — Formations never touched.  
**Repo:** `jejedu13376/urgency-the-road` · store docs `/cursor/stores/self/docs/urgency-road-one/`  
**Updated:** 2026-11-23 ~13:50 UTC · tip `main` `6d1e127` (merge #22) · #19 `487204c`

## Code status

**Merged on `main`:** #1–#22 (incl. #19 deferred security/crash, #21 Batch E, #22 docs sync).  
**Open PRs:** aucune.  
**GitHub Actions:** none configured (no check runs on tip).

| PR | What landed |
| --- | --- |
| #4 | BLE OBD live + gate/spinner + hosting docs + perf |
| #8 | Multi-IA Firebase Functions proxy |
| #9 | EAS restore (`eas.json`, Dev Client, ble-plx, runbooks) |
| #10 | Stubs deepen (live free APIs) |
| #12 | Docs deploy status / `DEPLOY-CHECKLIST` |
| #13 | Batch A local stubs (M2/M10/M12/M14/M16) |
| #14 | Analyze/fix (tsc, peers, M13 GPS, doc drift) |
| #15 | Batch B geo (M7/M8/M9) |
| #16 | Batch C M1/M3/M4 free/local/NHTSA/camera-text |
| #17 | SUIVI deploy-blocked note |
| #18 | Photon-only reverse geocode |
| #19 | Deferred security/crash — PHI, fleet, appointments, rate-limit, activeId rematch (`487204c`) |
| #20 | Docs sync post-#12–#18/#16 |
| #21 | Batch E remaining software stubs |
| #22 | Docs sync post-#19 (`6d1e127`) |

## Expo local vs deploy tokens

| Without `EXPO_TOKEN` / `FIREBASE_TOKEN` | Needs those (or local login) |
| --- | --- |
| `npx expo start` · 17 modules UI | EAS APK (`EXPO_TOKEN` / `eas login`) |
| Free APIs (NHTSA, Open-Meteo, Photon, Overpass) | `firebase deploy` rules/functions (`FIREBASE_TOKEN` / `firebase login`) |
| Multi-IA **heuristic** | Live LLM votes (provider keys + proxy URL) |
| Client Firebase/YouTube via `EXPO_PUBLIC_*` `.env` | — |

## Deploy / secrets (2026-11-23 update)

| Secret / config | Status |
| --- | --- |
| `EXPO_TOKEN` | **Present + valid** (`whoami` = `jejedu13376`) · APK `e36fd307` **FINISHED** |
| `FIREBASE_TOKEN` / local `firebase login` | Used for deploy when present (CI / Dashboard) |
| Multi-IA provider keys (`ANTHROPIC_API_KEY`, …) | Server-side only — set the engines you use |
| `functions:multiIa` | **LIVE** → `https://us-central1-urgency-road.cloudfunctions.net/multiIa` |
| `EXPO_PUBLIC_MULTI_IA_PROXY_URL` | **Paste into local `.env`** (see `.env.example` / `docs/MULTI-IA-PROXY.md`) |
| `EXPO_PUBLIC_INSTALL_URL` | Optional — set to APK / build page URL after install |

Once Lorenzo injects secrets → **`docs/DEPLOY-CHECKLIST.md`**. Tonight framing → **`docs/urgency-road-one/SUIVI.md`**. Modules → **`docs/MODULES-STATUS.md`**.

## Done vs blocked

| Item | Done | Blocked on Lorenzo / secrets |
| --- | --- | --- |
| M1–M17 UI + free APIs | On `main` (batches A/B/C) | OEM / paid / hardware as per MODULES-STATUS |
| Firebase Auth/Firestore code + rules | On `main` | `firebase deploy` rules/indexes |
| Multi-IA proxy | Deployed live + health OK | Client `.env` paste + provider keys |
| EAS APK | Preview APK `e36fd307` finished | Optional: set `EXPO_PUBLIC_INSTALL_URL` |
| Formations | Standby | — (never touch) |

## Client-only checklist (after secrets)

```bash
# multiIa already live — Lorenzo pastes into root .env:
EXPO_PUBLIC_MULTI_IA_PROXY_URL=https://us-central1-urgency-road.cloudfunctions.net/multiIa
# optional install share (APK e36fd307):
# EXPO_PUBLIC_INSTALL_URL=https://expo.dev/accounts/jejedu13376/projects/urgency-road-one/builds/e36fd307-416c-474f-aa31-bc7433d65064
npx expo start -c
```

## Payments

Lydia **removed**. Methods: Stripe cards, PayPal, Apple Pay, Google Pay only.

## Formations

**Standby** — never touch.
