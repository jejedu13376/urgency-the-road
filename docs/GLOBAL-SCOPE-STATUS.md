# GLOBAL SCOPE STATUS — Urgency Road (17 modules)

**Scope:** Urgency Road ONLY — Formations never touched.  
**App:** `/home/ubuntu/Axarel/urgency-road-one` · mirror `/cursor/stores/self/urgency-road-one/`

## Done this pass (backends + shell)

1. **VIN NHTSA** live decode (no API key) + mock fallback  
2. **Camera VIN scan** via `expo-camera` barcode scanner  
3. **Payments (Stripe·PayPal·Apple·Google — no Lydia) scaffold** Stripe Checkout / RevenueCat — refuses success without config  
4. **OBD BLE path** scaffold + Expo Go limitation documented  
5. **Firebase Auth** code paths + **Firestore rules** + deploy docs  
6. **YouTube** already live when key set  
7. **Red top-left spinner** + **startup gate** preserved  
8. Module UIs deepened in parallel (M1–M17 + hubs) — ongoing polish

## Done vs blocked

| Item | Done | Blocked on client |
| --- | --- | --- |
| M1 VIN + fiche + scan | Code live NHTSA/camera | Network / camera permission |
| M2–M17 UI local | Expanded / expanding | Deep OEM data feeds |
| Firebase Auth/Firestore | Code + rules | `.env` + Console enable + deploy |
| YouTube | Code | API key restrict |
| Payments (Stripe·PayPal·Apple·Google — no Lydia) | Scaffold | Stripe URL / RC + Dev Client |
| OBD BLE | Scaffold | Dev Client + dongle |
| Multi-IA providers | UI router | Server API keys |
| Seller streak/XP/badges | ProgressHero / Menu | — |

## Client-only checklist

```bash
cp .env.example .env   # fill Firebase + optional YouTube/Stripe
cd firebase && firebase deploy --only firestore:rules,firestore:indexes
npx expo start -c
```

See `LIVE-BACKENDS-STATUS.md` + `docs/FIREBASE-DEPLOY.md`.


## Payments update
Lydia **removed**. Methods: Stripe cards, PayPal, Apple Pay, Google Pay only.

## Integrate follow-up (M2–M17 expand + backends)

Merged UI expands from parallel agents into `cursor/integrate-modules-backends-e72c`, preserving:
- Firebase/YouTube env wiring
- NHTSA + VinCameraScanner
- OBD valise recommendation (subscriber buys)
- Payments Stripe/PayPal/Apple/Google (no Lydia)
- Red top-left spinner + startup gate
- Medical QR service files

Synced to `/cursor/stores/self/urgency-road-one/`.
