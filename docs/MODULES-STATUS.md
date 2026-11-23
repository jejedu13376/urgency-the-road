# Urgence Mécanique — 17 modules status

**App:** `/home/ubuntu/Axarel/urgency-road-one`  
**Shell:** Expo Router · tabs FR · onglet exact **« Mon véhicule »**  
**Formations:** PAUSED (untouched)

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

| M | Écran | Coded (UI / local) | Stub (pas live) |
| --- | --- | --- | --- |
| 1 | `/(tabs)/mon-vehicule` | VIN input, fiche, fluides, pannes, flotte link | API VIN OEM, scan caméra |
| 2 | `/modules/flotte` | Cascade continent→…→motorisation, multi-flotte | — |
| 3 | `/modules/pieces` | Liste pièces, comparateur, pose | Catalogue mondial, OCR devis IA |
| 4 | `/modules/diagnostic-ia` | Questions, politesse, UI photo/son | IA photo/vidéo/micro live |
| 5 | `/modules/obd` | DTC mock OBD2+J1939, capteurs simulés | BT/Wi-Fi/USB valise |
| 6 | `/modules/multi-ia` | Routeur UI, `expo-speech` + Stop Voix | Claude/GPT/Gemini/Grok/Mistral/DeepSeek, web recalls |
| 7 | `/modules/gps` | Modes PL/voiture, deep-links Maps/Waze/Apple | Graphe ponts/PTAC live |
| 8 | `/modules/routiers` | Liste pesage & dépôts PL | Alertes temps réel |
| 9 | `/modules/garages` | Pins mock + `tel:` | Géoloc live |
| 10 | `/modules/entretien` | Rappels km/dates, carnet | PDF certifié réel |
| 11 | `/modules/tutoriels` | Étapes par modèle | Lecteur vidéo CDN |
| 12 | `/(tabs)/fil` | Feed + refresh | Upload vidéo live |
| 13 | `/modules/urgence` + SOS root | 112, share position, chrono 4h | GPS précis live |
| 14 | `/modules/bases` | Log apprentissage, sync UI | OTA cloud |
| 15 | `/modules/compte` | Règles MDP, bio API, plans | Lydia/Stripe/Apple/Google Pay |
| 16 | `/modules/partage` | Share sheet multi-canal | Lien install prod |
| 17 | `/modules/pro` + `/modules/admin` | Atelier, devis list, flags, analytics mock | Backend Pro/Admin |

## Run

```bash
cd /home/ubuntu/Axarel/urgency-road-one
npm install
npx expo start
```

Typecheck: `npx tsc --noEmit` (clean).
