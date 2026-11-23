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

## Deploy / secrets (blocked)

Deploy is **blocked on secrets** — not on code. Agent attempt: **nothing deployed**.

| Secret / config | Status |
| --- | --- |
| `EXPO_TOKEN` | **Absent** → no EAS APK tonight without Lorenzo |
| `FIREBASE_TOKEN` / local `firebase login` | **Absent** → no rules/functions deploy |
| Multi-IA provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`) | **Absent** (server-side only) |
| `EXPO_PUBLIC_MULTI_IA_PROXY_URL` | Not set (needs functions deploy first) |
| `EXPO_PUBLIC_INSTALL_URL` | Not set (set after EAS APK) |

Once Lorenzo injects secrets → **`docs/DEPLOY-CHECKLIST.md`**. Tonight framing → **`docs/urgency-road-one/SUIVI.md`**. Modules → **`docs/MODULES-STATUS.md`**.

## Done vs blocked

| Item | Done | Blocked on Lorenzo / secrets |
| --- | --- | --- |
| M1–M17 UI + free APIs | On `main` (batches A/B/C) | OEM / paid / hardware as per MODULES-STATUS |
| Firebase Auth/Firestore code + rules | On `main` | `firebase deploy` rules/indexes |
| Multi-IA proxy | Code on `main` (#8) | Provider secrets + functions deploy + proxy URL |
| EAS APK | Config on `main` (#9) | `EXPO_TOKEN` / `eas login` |
| Formations | Standby | — (never touch) |

## Client-only checklist (after secrets)

```bash
firebase deploy --config firebase/firebase.json \
  --only firestore:rules,firestore:indexes,functions:multiIa --project urgency-road
npx eas-cli build -p android --profile preview
# then set EXPO_PUBLIC_MULTI_IA_PROXY_URL + EXPO_PUBLIC_INSTALL_URL in app .env
```

## Payments

Lydia **removed**. Methods: Stripe cards, PayPal, Apple Pay, Google Pay only.

## Formations

**Standby** — never touch.
