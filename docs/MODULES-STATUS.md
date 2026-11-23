# Urgence Mécanique — 17 modules status

**App:** `jejedu13376/urgency-the-road`  
**Shell:** Expo Router · tabs FR · onglet exact **« Mon véhicule »**  
**Formations:** PAUSED (untouched)  
**Updated:** 2026-11-23 — Deferred bugs [#19](https://github.com/jejedu13376/urgency-the-road/pull/19) `487204c` (PHI, fleet, appointments, rate-limit, activeId rematch) · Batch E [#21](https://github.com/jejedu13376/urgency-the-road/pull/21) · Batch C [#16](https://github.com/jejedu13376/urgency-the-road/pull/16) · Photon [#18](https://github.com/jejedu13376/urgency-the-road/pull/18) · Deploy blocked: `FIREBASE_TOKEN` / Multi-IA / `EXPO_TOKEN`

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

| M | Écran | LIVE / coded | Still stub / blocked |
| --- | --- | --- | --- |
| 1 | `/(tabs)/mon-vehicule` | NHTSA VIN + camera scan · fluids heuristique · recalls | OEM deep fluids API |
| 2 | `/modules/flotte` | Cascade + flotte AsyncStorage **uid-scoped** · Firestore pull + migrate **explicite** | — |
| 3 | `/modules/pieces` | VIN/WMI catalogue local + buy search URLs · **OCR-lite collage texte** + saisie manuelle | Mondial OEM catalogue · OCR ML Kit / Document AI |
| 4 | `/modules/diagnostic-ia` | Camera LIVE + Multi-IA **texte** · YouTube · **micro LIVE expo-audio + metering** | Vision pixels (API / modèle vision) |
| 5 | `/modules/obd` | VIN→valise reco · BLE scaffold (ELM327 path coded) | **Hardware:** Dev Client + dongle BLE |
| 6 | `/modules/multi-ia` | Heuristic + proxy-only client + NHTSA recalls | **Service:** `EXPO_PUBLIC_MULTI_IA_PROXY_URL` + provider secrets (deploy other workers) |
| 7 | `/modules/gps` | Device GPS · Open-Meteo **forward** · Photon **reverse** · Maps/Waze/Apple · OSM maxheight advisory | Graphe ponts/PTAC commercial |
| 8 | `/modules/routiers` | Overpass/Photon weigh + dépôts · radius · **opening_hours OSM advisory ON/OFF** | Feed ON/OFF juridiction payant (no free global live API) |
| 9 | `/modules/garages` | Overpass/Photon around GPS · radius · tel/maps | Places proprietary API |
| 10 | `/modules/entretien` | Rappels km/admin · carnet AsyncStorage · share texte/HTML-lite · **PDF imprimable expo-print** | PDF certifié signé (backend signature) |
| 11 | `/modules/tutoriels` | YouTube suggestions + redirection | — (cahier: pas de vidéo embarquée) |
| 12 | `/(tabs)/fil` | Texte Firestore si Auth · likes/comments locaux · **pick vidéo locale** (méta) | Upload vidéo CDN |
| 13 | `/modules/urgence` + SOS | SOS/112/QR · **GPS device only** (refuse fallback) | **Produit:** auth secours (badge / abo intervenant) |
| 14 | `/modules/bases` | learnedFailures owner-write + AsyncStorage journal + migrate Auth · OTA probe honnête | OTA EAS canal prod |
| 15 | `/modules/compte` | Auth + bio + password rules · checkout URL scaffolding | **Service:** Stripe / PayPal / RevenueCat keys |
| 16 | `/modules/partage` | Share sheet multi-canal · install URL resolve/open | `EXPO_PUBLIC_INSTALL_URL` prod |
| 17 | `/modules/pro` + `/modules/admin` | RDV Firebase si Auth · **KPI / flags / avis persistés AsyncStorage** | **Backend:** Pro/Admin KPI cloud + atelier server |

### Batch E — software fills (this PR)

| M | What landed |
| --- | --- |
| **3** | `parseQuoteTextAmounts` OCR-lite from pasted devis text → market compare |
| **4** | `expo-audio` mic capture + metering heuristic (`acousticMic.ts`) — no fake ML audio |
| **8** | `openingHours.ts` advisory ON/OFF from OSM `opening_hours` tags (not live feed) |
| **10** | `shareCarnetPdf` via `expo-print` + `expo-sharing` (explicitly non-certified) |
| **12** | `pickLocalVideo` via `expo-image-picker` — on-device only; CDN still blocked |
| **17** | Admin flags/mod/accounts + Pro ratings/KPI persisted locally |

### Batch D — hardware / service waits (no fake fills)

| M | Why left stubbed |
| --- | --- |
| **5** | Physical OBD dongle + native BLE Dev Client build required for live DTC/sensors |
| **6** | Live LLM votes need deployed `functions:multiIa` + provider secrets + client proxy URL (secrets/deploy workers) |
| **13** | Secours QR full PHI needs authenticated intervenant product (subscription + verified badge) — not free API |
| **15** | Payments need Stripe/PayPal/RC checkout bases — never invent success |
| **17** | Atelier KPI / super-admin **cloud** analytics need backend Pro — local UI + Auth RDV + AsyncStorage only |
| **1** | OEM deep fluids / Mondial catalogue = paid OEM APIs |
| **4** | Vision pixels need vision API or on-device CV model (secrets / heavy native) |
| **7** | Commercial truck routing graph (ponts/PTAC) |
| **8** | Live jurisdiction weigh ON/OFF feeds (paid / regional) |
| **9** | Google/Apple Places proprietary |
| **10** | Cryptographic PDF certification backend |
| **12** | Video CDN / object storage upload |
| **14** | EAS Update production channel (deploy) |
| **16** | Production `EXPO_PUBLIC_INSTALL_URL` value (config, not code) |

## Run

```bash
cd /workspace   # or local clone
npm install
# Cloud Functions typecheck is separate (own package.json):
#   cd firebase/functions && npm install && npm run typecheck
npx expo start
npx tsc --noEmit
```
