# GLOBAL SCOPE STATUS — Urgency Road (17 modules)

**Scope:** Urgency Road ONLY — Formations never touched.  
**Repo:** `jejedu13376/urgency-the-road` · store mirror `/cursor/stores/self/urgency-road-one/` · docs `/cursor/stores/self/docs/urgency-road-one/`  
**Updated:** 2026-11-23 ~11:55 UTC

## Code status

**All Urgency code PRs merged to `main`:** #4, #8, #9, #10, #11 (plus earlier #1/#2/#3/#5/#7).  
**Open fix PR:** #14 (`cursor/analyze-fix-urgency-91d8`) — typecheck exclude, worklets peer, M13 GPS honesty, doc sync.

| PR | What landed |
| --- | --- |
| #4 | BLE OBD live + gate/spinner + hosting docs + perf |
| #8 | Multi-IA Firebase Functions proxy |
| #9 | EAS restore (`eas.json`, Dev Client, ble-plx, runbooks) |
| #10 | Stubs deepen (live free APIs) |
| #11 | SUIVI tracking |
| #12 | Docs deploy status / checklist / path coherence |
| #14 | Analyze/fix (tsc, peers, M13 GPS, doc drift) — open |

## Deploy / secrets (blocked)

Deploy is **blocked on secrets** — not on code.

| Secret / config | Status |
| --- | --- |
| `EXPO_TOKEN` | **Absent** (cloud + store `.env`) |
| Multi-IA provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`) | **Absent** from store `.env` (names only — never commit values) |
| `FIREBASE_TOKEN` / ADC | Absent on cloud agents |
| `EXPO_PUBLIC_MULTI_IA_PROXY_URL` | Not set (needs functions deploy first) |
| `EXPO_PUBLIC_INSTALL_URL` | Not set (set after EAS APK / Releases asset) |

**Workers:**

- Secrets worker **done** (UR-40 audit): `bc-b182fbed-bef2-5a50-9b96-c060c8fc419d` — all CI/deploy secrets truly missing; nothing to configure; Firebase/EAS not attempted. Evidence: `/cursor/stores/self/internal/ur40-secrets-audit.md`
- Deploy worker may also run: `bc-8dc7803d-5d62-5c25-b208-72fe20652a29` (left alone by secrets worker)

Once Lorenzo injects secrets → follow **`docs/DEPLOY-CHECKLIST.md`**.

## Done vs blocked

| Item | Done | Blocked on Lorenzo / secrets |
| --- | --- | --- |
| M1 VIN + fiche + scan | Code live NHTSA/camera | Network / camera permission |
| M2–M17 UI + free APIs | Expanded | Deep OEM / paid feeds |
| Firebase Auth/Firestore | Code + rules on main | Console enable + `firebase deploy` rules/indexes |
| Multi-IA proxy | Code on main (#8) | Provider secrets + functions deploy + `EXPO_PUBLIC_MULTI_IA_PROXY_URL` |
| YouTube | Code | API key restrict (key name may already be in local `.env`) |
| Payments (Stripe·PayPal·Apple·Google — no Lydia) | Scaffold | Stripe URL / RC + Dev Client |
| OBD BLE | Live path on main | Dev Client + dongle + Expo auth |
| EAS APK | Config on main (#9) | `EXPO_TOKEN` / `eas login` |
| Seller streak/XP/badges | ProgressHero / Menu | — |

## Client-only checklist (after secrets)

See **`docs/DEPLOY-CHECKLIST.md`** for exact order. Short form:

```bash
# 1) Firebase (machine with login or FIREBASE_TOKEN)
firebase deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes,functions:multiIa --project urgency-road
# 2) App .env — set EXPO_PUBLIC_MULTI_IA_PROXY_URL + EXPO_PUBLIC_INSTALL_URL (after EAS)
# 3) EAS APK
npx eas-cli build -p android --profile preview
```

Also: `LIVE-BACKENDS-STATUS.md`, `docs/FIREBASE-DEPLOY.md`, `docs/MULTI-IA-PROXY.md`, `docs/EAS-RUNBOOK.md`.

## Payments

Lydia **removed**. Methods: Stripe cards, PayPal, Apple Pay, Google Pay only.

## Formations

**Standby** — never touch.
