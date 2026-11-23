# Urgency Road — suivi

Dernière mise à jour : 2026-11-23 ~11:45 UTC

## Fait (code sur `main`)

Tous les PRs code Urgency sont mergés. **Pas de hearts** — blockers restants = Lorenzo / secrets seulement.

| PR | Merge SHA | Contenu |
| --- | --- | --- |
| #1 | `933be45` | base wiring |
| #2 | `d654d59` | SUIVI + gitignore |
| #3 | `d92795c` | remint QR médical |
| #5 | `6fdf9d1` | Multi-IA proxy-only client, recalls, Fil, perf |
| #7 | `6d9c4ab` | Firebase deploy docs / blocker |
| **#4** | `1129ea4` | BLE OBD live + gate/spinner + hosting docs + perf (UR-27/28/29) |
| **#9** | `041eb36` | EAS restore (`eas.json`, Dev Client, ble-plx, runbooks) — tip `81a9cfc` |
| **#10** | `03a4efd` | Stubs deepen live free APIs — tip `9f8ff7c` |
| **#11** | `34a09b3` | SUIVI tracking |
| **#8** | `8b44d35` | Multi-IA Firebase Functions proxy — tip `d7f2674` |

Aussi fait côté secrets/config (ne pas coller dans le chat) :

- PayPal / YouTube / Firebase web `EXPO_PUBLIC_*` dans store `.env` (noms présents ; ne jamais coller les valeurs)
- Wiring `src/firebase/config.ts` + dep `firebase@^13.4.0`
- Formations en **standby** (site inchangé)

**Provisional download URL** : https://github.com/jejedu13376/urgency-the-road/releases (stand-in until first EAS APK)

## Deploy — blocked on secrets

Code ready ; **deploy bloqué tant que les secrets manquent**.

| Item | État |
| --- | --- |
| `EXPO_TOKEN` | **Absent** |
| Multi-IA provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`) | **Absent** du store `.env` |
| `FIREBASE_TOKEN` / ADC sur cloud agents | Absent |
| Secrets worker | **in progress** — `bc-b182fbed-bef2-5a50-9b96-c060c8fc419d` (pas encore de rapport final) |
| Deploy worker | peut aussi tourner — `bc-8dc7803d-5d62-5c25-b208-72fe20652a29` |

Checklist post-secrets : **`docs/DEPLOY-CHECKLIST.md`** (miroir store `docs/urgency-road-one/DEPLOY-CHECKLIST.md`).

## Reste — Lorenzo only (pas agent)

1. **Secrets** — fournir / confirmer ce que le secrets worker ne peut pas inventer (`EXPO_TOKEN`, provider Multi-IA, éventuellement `FIREBASE_TOKEN`). Ne jamais coller les valeurs dans le chat.

2. **Firebase deploy** (machine locale déjà loguée, ou token CI) — rules + indexes + functions :

```bash
cd /path/to/urgency-the-road
firebase deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes,functions:multiIa --project urgency-road
```

Puis coller l’URL `multiIa` dans `EXPO_PUBLIC_MULTI_IA_PROXY_URL`. Secrets serveur (ceux utilisés seulement) : `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY` (voir `docs/MULTI-IA-PROXY.md`).

3. **Install URL + EAS APK** — Path A `eas login` + `eas build -p android --profile preview`, ou Path B secret Cursor `EXPO_TOKEN` (voir `docs/EAS-RUNBOOK.md`). Après build, coller l’URL dans `EXPO_PUBLIC_INSTALL_URL`.

**Hosting note:** `firebase/firebase.json` n’a **pas** de cible Firebase Hosting. L’installable = EAS / Expo (voir `docs/HOSTING-RESTORE.md`), pas `firebase deploy --only hosting`.

Optionnel plus tard (hardware / marchands) : dongle BLE + Dev Client ; Stripe / Apple Pay / Google Pay.

Pour que l’agent puisse déployer Firebase plus tard : `firebase login:ci` → `FIREBASE_TOKEN`, ou `GOOGLE_APPLICATION_CREDENTIALS` (`docs/FIREBASE-DEPLOY.md`).

## Décisions

- Stripe / Apple Pay / Google Pay : comptes marchands + clés encore côté Lorenzo (PayPal déjà noté)
- Formations ≠ Urgency Road (projets stricts séparés) — Formations **standby**
- Multi-IA live = `EXPO_PUBLIC_MULTI_IA_PROXY_URL` seulement (pas de clés provider dans le bundle)
- Proxy Multi-IA = Firebase Functions dans le repo ; agent ship code+docs, Lorenzo login/secrets/deploy
- Bugbot : auto-fix sur branche ; merge seulement si Approval Agent OK sur tip courant
- Hearts seulement quand blockers Lorenzo ci-dessus sont levés

## Journal

| Quand (Edmonton / UTC) | Événement |
| --- | --- |
| 2026-11-22 ~23:13 | PR #1 mergée (`933be45`) |
| 2026-11-22 ~23:14 | Formations standby ; focus Urgency Road |
| 2026-11-22 ~23:15 | Optimisation app ajoutée aux priorités |
| 2026-11-22 ~23:18 | Ce fichier `SUIVI.md` créé ; sauvegarde GitHub demandée |
| 2026-11-22 ~23:19 | Audit clés : `.env` gitignoré ; docs nettoyés (placeholders) |
| 2026-11-22 ~23:20 | PR #2 SUIVI GitHub ; PR #3 Bugbot remint ; PR #4 BLE/gate/hosting/perf ouverte |
| 2026-11-22 ~23:26 | PR #2 mergée (`d654d59`) |
| 2026-11-22 ~23:29 | PR #3 mergée (`d92795c`) |
| 2026-11-23 ~05:40 UTC | PR #5 mergée (`6fdf9d1`) |
| 2026-11-23 ~05:50 UTC | PR #7 mergée (`6d9c4ab`) ; deploy Firestore = Lorenzo local |
| 2026-11-23 ~05:55 UTC | PR #8 ouverte (Multi-IA Functions) |
| 2026-11-23 ~06:00 UTC | PR #9 ouverte (EAS) ; provisional = GitHub Releases |
| 2026-11-23 ~06:17 UTC | PR #4 mergée (`1129ea4`) — UR-27/28/29 |
| 2026-11-23 ~06:21 UTC | PR #11 SUIVI mergée (`34a09b3`) |
| 2026-11-23 ~06:39 UTC | PR #9 mergée (`041eb36`) — EAS ; `EXPO_TOKEN` unset |
| 2026-11-23 ~06:52 UTC | PR #10 mergée (`03a4efd`) — stubs live APIs |
| 2026-11-23 ~07:04 UTC | PR #8 mergée (`8b44d35`) — Multi-IA proxy code on main |
| 2026-11-23 ~07:05 UTC | **Tous PRs code Urgency mergés** (#4/#8/#9/#10/#11). Reste Lorenzo : Firebase deploy + functions/secrets + EXPO_TOKEN. Formations standby. **Pas de hearts.** |
| 2026-11-23 ~11:45 UTC | Docs sync : GLOBAL-SCOPE + SUIVI à jour ; deploy blocked on secrets ; secrets worker **in progress** (`bc-b182fbed…`) ; deploy worker may run (`bc-8dc7803d…`) ; `EXPO_TOKEN` + Multi-IA provider keys absent store `.env` ; `DEPLOY-CHECKLIST.md` ajouté. Formations standby. |
