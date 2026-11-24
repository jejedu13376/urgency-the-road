# Urgency Road — suivi

Dernière mise à jour : 2026-11-23 ~13:50 UTC  
**Tip `main`:** `6d1e127` (merge #22) · **#19:** `487204c` · **Formations:** standby (untouched) · **Hearts:** non (secrets Lorenzo)

---

## Ce soir — sans Lorenzo (agents / code)

Déjà sur `main` sans action Lorenzo :

| Item | État |
| --- | --- |
| App Expo Router · 17 modules UI | Code mergé (#1–#21) |
| Free live APIs (NHTSA, Open-Meteo, Photon, Overpass, YouTube client) | Coded |
| Multi-IA **heuristic** + proxy client + Functions source | Coded (#8) — votes LLM **pas** live sans deploy |
| BLE OBD path + EAS config (`eas.json`, runbooks) | Coded (#4/#9) |
| Deferred security/crash (#19) | **Mergé** — PHI, fleet, appointments, rate-limit, activeId rematch |
| Docs sync post-#19 (#22) | **Mergé** `6d1e127` |
| Docs deploy / secrets / modules sync | À jour (ce fichier + `MODULES-STATUS` / `DEPLOY-CHECKLIST`) |
| Open PRs | **Aucune** |
| GitHub Actions on `main` | **Aucun workflow** — pas de check runs sur tip |

**Expo local sans tokens deploy:** `npm install` → `npx expo start` (UI + free APIs + heuristic Multi-IA).  
Client Firebase/YouTube = `EXPO_PUBLIC_*` dans `.env` — **pas** `FIREBASE_TOKEN` / `EXPO_TOKEN`.  
**Pas de APK téléchargeable** sans Lorenzo (`EXPO_TOKEN` / `eas login`).  
**Pas de Firebase rules/functions live** sans Lorenzo (`FIREBASE_TOKEN` / `firebase login`).  
Provisional stand-in : https://github.com/jejedu13376/urgency-the-road/releases (vide jusqu’au 1er APK).

---

## Ce soir — Lorenzo only (secrets → APK / Firebase)

Sans coller de valeurs dans le chat. Noms exacts :

### A) APK téléchargeable (priorité « download tonight »)

| Nom | Pourquoi |
| --- | --- |
| `EXPO_TOKEN` (ou `eas login` local) | Auth EAS — cloud agent : **Not logged in** |

Puis (local ou agent après token) :

```bash
cd /path/to/urgency-the-road
npx eas-cli whoami
npx eas-cli build:configure   # 1ʳᵉ fois — commit projectId/owner
npx eas-cli build -p android --profile preview
```

Après build → coller l’URL dans `EXPO_PUBLIC_INSTALL_URL` (Module 16). Détail : `docs/EAS-RUNBOOK.md` · ordre : `docs/DEPLOY-CHECKLIST.md` §3–4.

### B) Firebase + Multi-IA live

| Nom | Pourquoi |
| --- | --- |
| `FIREBASE_TOKEN` (via `firebase login:ci`) **ou** `firebase login` local | Deploy rules / indexes / `functions:multiIa` |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY` | Secrets **serveur** Function (ceux utilisés seulement) |
| `EXPO_PUBLIC_MULTI_IA_PROXY_URL` | Après deploy — URL HTTPS `…/multiIa` (app `.env`) |

```bash
firebase deploy --config firebase/firebase.json \
  --only firestore:rules,firestore:indexes,functions:multiIa \
  --project urgency-road
```

**Hosting:** `firebase/firebase.json` = firestore + functions **seulement** — **pas** de cible Hosting. Installable = EAS APK (`docs/HOSTING-RESTORE.md`).

Déjà côté app (hors CI deploy ; ne pas coller valeurs) : `EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_YOUTUBE_API_KEY`, `PAYPAL_*` (store `.env`).

Audit UR-40 : Multi-IA ×6 + `FIREBASE_TOKEN` + `EXPO_TOKEN` / `EXPO_ACCESS_TOKEN` = **MANQUANTS**. Deploy agent = **rien déployé**.

---

## Modules — résumé (M1–M17)

Détail : `docs/MODULES-STATUS.md`.

| M | Statut résumé | Bloqué / stub |
| --- | --- | --- |
| 1 Mon véhicule | LIVE NHTSA VIN + camera + recalls | OEM fluids |
| 2 Flotte | LIVE local uid-scoped + Firestore migrate · activeId rematch (#19) | — |
| 3 Pièces | LIVE catalogue WMI + buy URLs | OEM / OCR ML |
| 4 Diagnostic IA | LIVE camera + texte Multi-IA + YouTube | Vision pixels |
| 5 OBD | Path BLE coded | **Hardware** Dev Client + dongle |
| 6 Multi-IA | Heuristic + proxy client · rate-limit UID (#19) | **`EXPO_PUBLIC_MULTI_IA_PROXY_URL` + provider keys + deploy** |
| 7 GPS | LIVE carte plein écran · Valhalla auto/truck · AsyncStorage · OSM maxheight · sync profil camion (L/W/H/essieux) · carnet vocal post-trajet | PTAC commercial |
| 8 Routiers | LIVE Overpass/Photon · profil camion/remorque + routes allow/restrict advisory | Feed juridiction |
| 9 Garages | LIVE Overpass/Photon | Places API |
| 10 Entretien | LIVE carnet + share | PDF certifié |
| 11 Tutoriels | LIVE YouTube redirect | — |
| 12 Fil | LIVE texte Firestore si Auth | Upload vidéo CDN |
| 13 Urgence / SOS | LIVE SOS/QR · **QR hors ligne local** (générate SVG + AsyncStorage + scan UMQR1) · GPS device only · PHI mock exact (#19) | Auth secours produit |
| 14 Bases | LIVE learnedFailures + OTA probe | OTA canal prod |
| 15 Compte | LIVE Auth + checkout scaffold | Stripe / PayPal / RC keys |
| 16 Partage | LIVE share sheet | **`EXPO_PUBLIC_INSTALL_URL`** (après APK) |
| 17 Pro / Admin | LIVE RDV si Auth + UI locale · appointments failResult (#19) | KPI atelier backend |

---

## Fait — PRs sur `main`

| PR | Merge SHA | Contenu |
| --- | --- | --- |
| #1 | `933be45` | Firebase/YouTube env wiring |
| #2 | `d654d59` | SUIVI + gitignore |
| #3 | `d92795c` | remint QR médical |
| #5 | `6fdf9d1` | Multi-IA proxy-only client, recalls, Fil, perf |
| #6 | `256ab51` | SUIVI PR #5 |
| #7 | `6d9c4ab` | Firebase deploy docs / blocker |
| #4 | `1129ea4` | BLE OBD + gate/spinner + hosting docs |
| #11 | `34a09b3` | SUIVI tracking |
| #9 | `041eb36` | EAS restore |
| #10 | `03a4efd` | Stubs deepen live free APIs |
| #8 | `8b44d35` | Multi-IA Firebase Functions proxy |
| **#12** | `6ee194c` | Docs deploy status + `DEPLOY-CHECKLIST` |
| **#14** | `187c361` | Analyze/fix (tsc, peers, M13 GPS, docs) |
| **#13** | `671f2a5` | Batch A stubs (M2/M10/M12/M14/M16) |
| **#15** | `77c3d90` | Batch B geo (M7/M8/M9) |
| **#17** | `4f4db6d` | SUIVI deploy blocked |
| **#18** | `cdf3e04` | Photon-only reverse geocode |
| **#16** | `c31633d` | Batch C M1/M3/M4 free/local paths |
| **#20** | `1dd989c` | Docs sync post-#12–#18/#16 |
| **#21** | `d210e5c` | Batch E remaining software stubs |
| **#19** | `487204c` | Deferred security/crash — PHI, fleet, appointments, rate-limit, activeId rematch (tip `703e07e`) |
| **#22** | `6d1e127` | Docs sync post-#19 (SUIVI / MODULES / GLOBAL) |

**Open PRs:** aucune.

---

## Docs canoniques (chemins)

| Doc | Repo | Store mirror |
| --- | --- | --- |
| SUIVI | `docs/urgency-road-one/SUIVI.md` | `docs/urgency-road-one/SUIVI.md` |
| Modules | `docs/MODULES-STATUS.md` | `docs/urgency-road-one/MODULES-STATUS.md` |
| Backend | `docs/BACKEND-SETUP.md` | `docs/urgency-road-one/BACKEND-SETUP.md` |
| Deploy order | `docs/DEPLOY-CHECKLIST.md` | `docs/urgency-road-one/DEPLOY-CHECKLIST.md` |
| Firebase CDN | `docs/urgency-road-one/FIREBASE-CDN.md` | `docs/urgency-road-one/FIREBASE-CDN.md` |
| Firebase CLI | `docs/FIREBASE-DEPLOY.md` | `docs/urgency-road-one/FIREBASE-DEPLOY.md` |
| Multi-IA | `docs/MULTI-IA-PROXY.md` | (repo) |
| EAS APK | `docs/EAS-RUNBOOK.md` | `docs/urgency-road-one/EAS-RUNBOOK.md` |

Variables app : `.env.example` → `EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_YOUTUBE_API_KEY`, `EXPO_PUBLIC_MULTI_IA_PROXY_URL`, `EXPO_PUBLIC_INSTALL_URL`.  
Deploy CLI : `--config firebase/firebase.json` · project `urgency-road`.

---

## Décisions

- Formations ≠ Urgency Road — **standby**
- Multi-IA live = proxy URL only (pas de clés LLM dans `EXPO_PUBLIC_*`)
- Hearts seulement quand blockers Lorenzo (APK + Firebase) levés
- Deferred bugs (#19) **landed** — file ouverte vide

## Journal (récent)

| Quand (UTC) | Événement |
| --- | --- |
| ~23:30 | Profil camion / remorque (trek, L/W/H, essieux, équipement) + routes autorisées/restreintes advisory — PR ouverte |
| ~11:50 | PR #12 mergée — docs deploy + checklist |
| ~11:54 | PR #14 mergée — analyze/fix |
| ~11:55 | PR #13 / #15 mergées — Batch A/B stubs |
| ~11:56 | Deploy worker blocked — rien déployé |
| ~11:57 | PR #17 mergée — SUIVI deploy blocked |
| ~12:01 | PR #18 mergée — Photon-only reverse |
| ~12:11 | PR #16 mergée — Batch C M1/M3/M4 |
| ~12:15 | Docs sync post-#12–#18/#16 ; #19 pending ; ce soir = APK/Firebase = Lorenzo secrets |
| ~12:20 | PR #20 mergée — docs sync |
| ~12:xx | PR #21 mergée — Batch E software stubs |
| ~13:11 | PR #19 mergée `487204c` (tip `703e07e`) — PHI, fleet, appointments, rate-limit, activeId rematch |
| ~13:13 | Docs sync post-#19 (#22 pending then merged) ; open deferred PRs = 0 ; Formations standby |
| ~13:15 | PR #22 mergée `6d1e127` — tip `main` |
| ~13:50 | Status tonight + secrets guide (store) ; CI = no Actions ; Expo local OK sans deploy tokens |
| ~22:50 | UR-89 GPS — PR `itinéraire` + menu destination (Share / AsyncStorage / stubs) ; helpers `gpsSavedPlaces` partagés vs Places reviews sibling |
| ~23:25 | UR-95 QR hors ligne — generate local SVG, payload AsyncStorage, scan sans réseau (branche `cursor/qr-offline-local-1b29`) |
