# Urgence Mécanique — 17 modules status

**App:** `jejedu13376/urgency-the-road`  
**Shell:** Expo Router · tabs FR · onglet exact **« Mon véhicule »**  
**Formations:** PAUSED (untouched)  
**Updated:** 2026-11-23 (America/Edmonton) — Batch G → **16/17 faits** (M15 paiement = standby utilisateur)

## Critère « fait »

**Fait** = chemin logiciel free/local livre le cahier MVP de bout en bout ; options payantes / hardware / secrets déployés listées en **External deps** (pas dans la colonne stub).  
Aligné sur M2 (flotte) et M11 (YouTube sans embed cahier).

## UX vendeur / addiction (leviers)

| Levier | Où |
| --- | --- |
| Progression 0–100% sur 17 modules | `ProgressHero` + `ProgressContext` |
| Streak quotidien (jours) | pill 🔥 + persistance AsyncStorage |
| Bonus XP journalier | bouton « Récupérer bonus XP » |
| XP + badges (Premier pas → Maître des 17) | +25 XP / premier visit module |
| Parcours Menu avec ✓ / ○ et CTA « Découvrir · +25 XP » | tab Menu |
| SOS flottant + bandeau météo (M13) | root layout |
| Palette propriétaire asphalt/signal (pas purple-AI) | `src/theme/colors.ts` |

## Coded vs stubbed

| M | Écran | Statut | LIVE / coded | Still stub / blocked |
| --- | --- | --- | --- | --- |
| 1 | `/(tabs)/mon-vehicule` | **Fait** | NHTSA VIN + camera · fluids heuristique **make-aware** · recalls | — |
| 2 | `/modules/flotte` | **Fait** | Cascade + flotte AsyncStorage uid-scoped · Firestore pull/migrate · empty copy | — |
| 3 | `/modules/pieces` | **Fait** | VIN/WMI catalogue local · buy URLs · OCR-lite collage | — |
| 4 | `/modules/diagnostic-ia` | **Fait** | Camera LIVE · **vision lite** (resize + focus) · Multi-IA texte · micro + metering · YouTube | — |
| 5 | `/modules/obd` | **Fait** | VIN→valise · BLE scaffold · **dictionnaire DTC local** · soft-fail sans fake DTC | — |
| 6 | `/modules/multi-ia` | **Fait** | Heuristic votes · proxy optionnel · NHTSA recalls · TTS coach · YouTube | — |
| 7 | `/modules/gps` + `/(tabs)/carte` | **Fait** | OSM plein écran · Valhalla auto/truck LIVE · prefs · maxheight advisory | — |
| 8 | `/modules/routiers` | **Fait** | Overpass/Photon weigh + dépôts · profil trek · opening_hours ON/OFF advisory | — |
| 9 | `/modules/garages` | **Fait** | Overpass/Photon autour GPS · phone/horaires OSM · rating soft Auth | — |
| 10 | `/modules/entretien` | **Fait** | Rappels · carnet AsyncStorage · PDF + **attestation locale (hash)** | — |
| 11 | `/modules/tutoriels` | **Fait** | YouTube suggestions + redirection | — (cahier: pas de vidéo embarquée) |
| 12 | `/(tabs)/fil` | **Fait** | Texte Firestore · pick local · **upload CDN Storage** (soft-fail Auth/rules) | — |
| 13 | `/modules/urgence` + SOS | **Fait** | SOS FAB · fiche · QR · **enrollment secours KYC local** · soft overlay | — |
| 14 | `/modules/bases` | **Fait** | learnedFailures + journal · OTA check/**apply** honnête | — |
| 15 | `/modules/compte` | Partiel | Auth + bio + password rules · checkout URL scaffold | Stripe / PayPal / RevenueCat keys (**standby user**) |
| 16 | `/modules/partage` | **Fait** | Share multi-canal · install URL env / linking / **Expo createURL** | — |
| 17 | `/modules/pro` + `/modules/admin` | **Fait** | RDV Firebase si Auth · KPI/avis locaux · **export snapshot JSON** | — |

### Rollup

| Bucket | Count | Modules |
| --- | ---: | --- |
| **Fait** (stub column `—`) | **16** | M1–M14, M16, M17 |
| Partiel | **1** | M15 (paiement — standby) |
| Screens exist | **17/17** | All routes |

### External deps (not module stubs)

| Area | Why external |
| --- | --- |
| OEM deep fluids / Mondial catalogue / Places / PTAC commercial / jurisdiction weigh feeds | Paid APIs |
| Vision **ML / CV model** (M4) | Paid vision API — lite resize+focus already fait |
| OBD **dongle + Dev Client** (M5) | Hardware — BLE software + DTC dict already fait |
| Fil CDN **moderation / prod rules deploy** (M12) | Ops deploy storage.rules — SDK path already fait |
| Secours **admin role elevation** (M13) | Firestore freezes self role — product KYC local already fait |
| Stripe / PayPal / RC **keys** (M15) | Checkout keys (ops) — **standby**, software scaffold only |
| Multi-IA live LLM votes | Deploy `multiIa` + provider secrets (heuristic path already fait) |
| EAS Update prod channel value | Ops config (software check/apply fait) |
| `EXPO_PUBLIC_INSTALL_URL` prod | Ops config (Expo deep-link fallback fait) |
| Server-signed PDF juridique | Optional backend (local attestation fait) |
| Cloud Pro/Admin analytics | Optional backend (local KPI + export fait) |

### Batch G — software fills (this PR)

| M | What landed |
| --- | --- |
| **4** | `visionPixelsLite` — expo-image-manipulator resize + focus tags + optional vision proxy |
| **5** | `dtcDictionary` paste/lookup + elm327 parser tests |
| **12** | `uploadFeedVideo` Firebase Storage + owner-path `storage.rules` |
| **13** | `rescuerEnrollment` KYC checklist + soft overlay Auth |
| **15** | *(skipped — user standby)* |
| **Docs** | MODULES-STATUS → **16/17 faits** |

### Batch F — prior (PR #60)

| M | What landed |
| --- | --- |
| **1** | Fluides make-aware (`localFluids` bias table) + tests |
| **3** | Copy OEM/OCR reframed as options externes (OCR-lite MVP) |
| **10** | Attestation locale hash on carnet texte/HTML/PDF |
| **14** | OTA auto-probe + `applyOtaUpdateIfAvailable` |
| **16** | `expo-linking` `createURL('/')` fallback (pas de store inventé) |
| **17** | `exportProAtelierSnapshot` + share JSON depuis Pro |

## Run

```bash
cd /workspace   # or local clone
npm install
npx expo start
npx tsc --noEmit
npm test
```
