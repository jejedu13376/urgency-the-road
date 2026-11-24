# Urgence Mécanique — 17 modules status

**App:** `jejedu13376/urgency-the-road`  
**Shell:** Expo Router · tabs FR · onglet exact **« Mon véhicule »**  
**Formations:** PAUSED (untouched)  
**Updated:** 2026-11-23 (America/Edmonton) — Batch F software MVP → **12/17 faits** (free-path complete; paid/hardware/secrets = external ops)

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
| 4 | `/modules/diagnostic-ia` | Partiel | Camera LIVE · Multi-IA texte · YouTube · micro + metering | Vision pixels (API / modèle) |
| 5 | `/modules/obd` | Partiel | VIN→valise · BLE scaffold · soft-fail sans fake DTC | Dev Client + dongle BLE |
| 6 | `/modules/multi-ia` | **Fait** | Heuristic votes · proxy optionnel · NHTSA recalls · TTS coach · YouTube | — |
| 7 | `/modules/gps` + `/(tabs)/carte` | **Fait** | OSM plein écran · Valhalla auto/truck LIVE · prefs · maxheight advisory | — |
| 8 | `/modules/routiers` | **Fait** | Overpass/Photon weigh + dépôts · profil trek · opening_hours ON/OFF advisory | — |
| 9 | `/modules/garages` | **Fait** | Overpass/Photon autour GPS · phone/horaires OSM · rating soft Auth | — |
| 10 | `/modules/entretien` | **Fait** | Rappels · carnet AsyncStorage · PDF + **attestation locale (hash)** | — |
| 11 | `/modules/tutoriels` | **Fait** | YouTube suggestions + redirection | — (cahier: pas de vidéo embarquée) |
| 12 | `/(tabs)/fil` | Partiel | Texte Firestore · pick local video · publish soft | Upload vidéo CDN |
| 13 | `/modules/urgence` + SOS | Partiel | SOS FAB · fiche médicale · QR · pause 4h · soft secours | Auth secours / badge intervenant produit |
| 14 | `/modules/bases` | **Fait** | learnedFailures + journal · OTA check/**apply** honnête | — |
| 15 | `/modules/compte` | Partiel | Auth + bio + password rules · checkout URL scaffold | Stripe / PayPal / RevenueCat keys |
| 16 | `/modules/partage` | **Fait** | Share multi-canal · install URL env / linking / **Expo createURL** | — |
| 17 | `/modules/pro` + `/modules/admin` | **Fait** | RDV Firebase si Auth · KPI/avis locaux · **export snapshot JSON** | — |

### Rollup

| Bucket | Count | Modules |
| --- | ---: | --- |
| **Fait** (stub column `—`) | **12** | M1–M3, M6–M11, M14, M16, M17 |
| Partiel | **5** | M4, M5, M12, M13, M15 |
| Screens exist | **17/17** | All routes |

### External deps (not module stubs)

| Area | Why external |
| --- | --- |
| OEM deep fluids / Mondial catalogue / Places / PTAC commercial / jurisdiction weigh feeds | Paid APIs |
| Vision pixels (M4) | Vision API / on-device CV |
| OBD live DTC (M5) | Hardware dongle + Dev Client |
| Fil video CDN (M12) | Object storage + moderation |
| Secours KYC (M13) | Product + verified badge backend |
| Stripe / PayPal / RC (M15) | Checkout keys (ops) |
| Multi-IA live LLM votes | Deploy `multiIa` + provider secrets (heuristic path already fait) |
| EAS Update prod channel value | Ops config (software check/apply fait) |
| `EXPO_PUBLIC_INSTALL_URL` prod | Ops config (Expo deep-link fallback fait) |
| Server-signed PDF juridique | Optional backend (local attestation fait) |
| Cloud Pro/Admin analytics | Optional backend (local KPI + export fait) |

### Batch F — software fills (this PR)

| M | What landed |
| --- | --- |
| **1** | Fluides make-aware (`localFluids` bias table) + tests |
| **3** | Copy OEM/OCR reframed as options externes (OCR-lite MVP) |
| **10** | Attestation locale hash on carnet texte/HTML/PDF |
| **14** | OTA auto-probe + `applyOtaUpdateIfAvailable` |
| **16** | `expo-linking` `createURL('/')` fallback (pas de store inventé) |
| **17** | `exportProAtelierSnapshot` + share JSON depuis Pro |
| **Docs** | MODULES-STATUS → **12/17 faits** |

## Run

```bash
cd /workspace   # or local clone
npm install
npx expo start
npx tsc --noEmit
npm test
```
