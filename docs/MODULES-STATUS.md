# Urgence Mécanique — 17 modules status

**App:** `jejedu13376/urgency-the-road`  
**Shell:** Expo Router · tabs FR · onglet exact **« Mon véhicule »**  
**Formations:** PAUSED (untouched)  
**Updated:** 2026-11-23 — deepen stubs **merged** PR #10 → `03a4efd44cc4958048f5a74633445bcccdbb56bd` · audit/fix PR sync

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

## Coded vs stubbed (post deepen)

| M | Écran | LIVE / coded | Still stub / blocked |
| --- | --- | --- | --- |
| 1 | `/(tabs)/mon-vehicule` | NHTSA VIN + camera scan | OEM deep fluids API |
| 2 | `/modules/flotte` | Cascade + multi-flotte local | Cloud fleet backend |
| 3 | `/modules/pieces` | VIN/WMI catalogue local + buy search URLs | Mondial OEM catalogue · OCR ML |
| 4 | `/modules/diagnostic-ia` | Camera LIVE + Multi-IA **texte** · YouTube | Vision pixels · micro audio |
| 5 | `/modules/obd` | VIN→valise reco · BLE scaffold (PR #4) | Dev Client + dongle |
| 6 | `/modules/multi-ia` | Heuristic + proxy-only + NHTSA recalls | Server proxy keys |
| 7 | `/modules/gps` | Device GPS + Open-Meteo geocode + Maps handoff | Graphe ponts/PTAC commercial |
| 8 | `/modules/routiers` | Overpass/Photon weigh + dépôts · UNKNOWN if untagged | Feed ON/OFF juridiction |
| 9 | `/modules/garages` | Overpass/Photon around GPS · tel/maps | Places proprietary API |
| 10 | `/modules/entretien` | Rappels km/admin + **share carnet texte** | PDF certifié signé |
| 11 | `/modules/tutoriels` | YouTube suggestions + redirection | — (cahier: pas de vidéo embarquée) |
| 12 | `/(tabs)/fil` | Texte Firestore si Auth | Upload vidéo CDN |
| 13 | `/modules/urgence` + SOS | SOS/112/QR · **GPS device only** (refuse fallback) | Secours auth produit |
| 14 | `/modules/bases` | learnedFailures owner-write + **AsyncStorage journal** + migrate Auth | OTA EAS canal |
| 15 | `/modules/compte` | Auth + bio + password rules | Stripe/PayPal/RC keys |
| 16 | `/modules/partage` | Share sheet multi-canal | `EXPO_PUBLIC_INSTALL_URL` prod |
| 17 | `/modules/pro` + `/modules/admin` | RDV Firebase si Auth · admin UI locale | Backend Pro/Admin KPI |

## Run

```bash
cd /workspace   # or local clone
npm install
# Cloud Functions typecheck is separate (own package.json):
#   cd firebase/functions && npm install && npm run typecheck
npx expo start
npx tsc --noEmit
```
