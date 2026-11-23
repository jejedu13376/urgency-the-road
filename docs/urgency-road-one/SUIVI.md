# Urgency Road — suivi

Dernière mise à jour : 2026-11-23 ~06:18 UTC

## Fait

- Clés PayPal rangées dans `.env` (`PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`) — ne pas coller dans le chat
- Clé YouTube rangée (`EXPO_PUBLIC_YOUTUBE_API_KEY`)
- Config Firebase web rangée (`EXPO_PUBLIC_FIREBASE_*` + alias `FIREBASE_*`) ; snippet CDN/npm dans `FIREBASE-CDN.md`
- Wiring app vérifié : `src/firebase/config.ts` = 7 clés `EXPO_PUBLIC_FIREBASE_*` (aligné CDN) ; dep `firebase@^13.4.0` ; Analytics RN non branché (volontaire)
- PR #1 mergée dans `main` — merge `933be454ce03d3d784235709fcd54c132fa4d1fd` — https://github.com/jejedu13376/urgency-the-road/pull/1
- PR #2 mergée (`d654d59`) — SUIVI + gitignore
- PR #3 mergée (`d92795c`) — remint QR médical
- PR #5 mergée dans `main` — merge `6fdf9d153db1c88cede9c5f6c8d4a65babe1b6f7` — https://github.com/jejedu13376/urgency-the-road/pull/5
  - Docs deploy Firestore + `.firebaserc`
  - Multi-IA proxy-only + NHTSA recalls + Open-Meteo
  - Fil texte Firestore ; learnedFailures owner-only (pas de VIN)
  - Perf : YouTube cache, Firestore memory cache, icon compressée
- Formations en **standby** (site inchangé) ; 100 formations + optimisation **prévues** mais en pause
- PR #4 mergée dans `main` — merge `1129ea4e3f082fd2e467c8002b68db1721045870` — https://github.com/jejedu13376/urgency-the-road/pull/4
  - BLE OBD live path (ELM327/J1939) + shared BleManager / PoweredOn / Android perms
  - Startup gate + permanent red spinner (UR-27)
  - Hosting restore docs (UR-28)
  - Perf: icon compress, YouTube cache/timeout, Screen safe-area (UR-29)
  - Tip merged: `808fb73ccd08e42791992ec7137acda90f5e6624`
- **Multi-IA server proxy (code)** : PR [#8](https://github.com/jejedu13376/urgency-the-road/pull/8) — Firebase HTTPS `multiIa` + `docs/MULTI-IA-PROXY.md` (UR-35). Host live + secrets = Lorenzo.
- **Hosting Expo/EAS restore (UR-38)** : PR [#9](https://github.com/jejedu13376/urgency-the-road/pull/9) (`cursor/hosting-eas-restore-f6f5`) — `eas.json` (preview APK + Dev Client), `expo-dev-client` + `react-native-ble-plx`, BLE permissions iOS/Android, docs `HOSTING-RESTORE` / `EAS-RUNBOOK` / `BLE-DEV-CLIENT` / `OPTIM-PERF`. Formations untouched.
- **Provisional download URL** : https://github.com/jejedu13376/urgency-the-road/releases (stand-in until first EAS APK)

## Reste (Urgency Road)

- **BLOCKER Lorenzo (machine locale)** : login OK chez Lorenzo, mais **pas** sur le cloud agent — re-deploy agent 2026-11-23 ~05:49 UTC → encore `Failed to authenticate` / `Could not load the default credentials` ; `login:list` = aucune session ; project cible `urgency-road` ; rien déployé (ni rules, ni indexes, ni hosting). **Lorenzo doit lancer sur SA machine déjà loguée :**

```bash
cd /path/to/urgency-the-road
firebase deploy --config firebase/firebase.json --only firestore:rules,firestore:indexes --project urgency-road
```

  Pour que l’agent puisse déployer plus tard : `firebase login:ci` → injecter `FIREBASE_TOKEN`, ou `GOOGLE_APPLICATION_CREDENTIALS` (voir `docs/FIREBASE-DEPLOY.md`).
- **BLOCKER Lorenzo** : déployer proxy Multi-IA + secrets — `firebase deploy --config firebase/firebase.json --only functions:multiIa` puis coller l’URL dans `EXPO_PUBLIC_MULTI_IA_PROXY_URL` (voir `docs/MULTI-IA-PROXY.md`). Secrets exacts (ceux utilisés seulement) : `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`.
- Stubs restants : vidéo CDN, OBD BLE hardware (dongle + Dev Client), paiements (scaffolds sans faux succès)
- Build Dev Client pour BLE réel + dongle physique (code BLE déjà sur main via #4)
- **BLOCKER Lorenzo (EAS)** : `eas-cli whoami` → Not logged in sur cloud agent ; pas de `EXPO_TOKEN`. Pour APK réel : Path A `eas login` + `eas build -p android --profile preview` **ou** Path B token Expo → secret Cursor `EXPO_TOKEN` puis re-run agent (voir `docs/EAS-RUNBOOK.md` dans le repo).

## Décisions

- Stripe / Apple Pay / Google Pay : comptes marchands + clés encore côté Lorenzo (PayPal déjà noté)
- Formations ≠ Urgency Road (projets stricts séparés)
- CDN Firebase + `npm install firebase` notés pour réutilisation (`FIREBASE-CDN.md`)
- Bugbot : corriger automatiquement sur branche dédiée + push, sans attendre le feu vert
- Qualité d’abord (zéro régression) avant livraison
- Multi-IA live = `EXPO_PUBLIC_MULTI_IA_PROXY_URL` seulement (pas de clés provider dans le bundle)
- Proxy Multi-IA = Firebase Functions dans le repo ; agent ship code+docs, Lorenzo login/secrets/deploy

## Journal

| Quand (Edmonton / UTC) | Événement |
| --- | --- |
| 2026-11-22 ~23:13 | PR #1 mergée (`933be45`) |
| 2026-11-22 ~23:14 | Formations standby ; focus Urgency Road |
| 2026-11-22 ~23:15 | Optimisation app ajoutée aux priorités |
| 2026-11-22 ~23:18 | Ce fichier `SUIVI.md` créé ; sauvegarde GitHub demandée |
| 2026-11-22 ~23:19 | Audit clés : `.env` gitignoré ; `FIREBASE-CDN.md` / `ENV-YOUTUBE.env` docs nettoyés (placeholders) ; PayPal secret jamais dans git |
| 2026-11-22 ~23:20 | PR #2 SUIVI GitHub ; PR #3 Bugbot remint ; PR #4 BLE/gate/hosting/perf ouverte |
| 2026-11-22 ~23:22 | PR #2 : gitignore durci ; ENV-YOUTUBE retiré du repo ; historique sans secrets |
| 2026-11-22 ~23:23 | Branche stubs/Multi-IA/rules docs `12d3f5b` ; deploy Firebase = login Lorenzo |
| 2026-11-22 ~23:23 | PR #5 ouverte (rules docs, Multi-IA, stubs) |
| 2026-11-22 ~23:26 | PR #2 mergée (`d654d59`) — SUIVI + gitignore sur main |
| 2026-11-22 ~23:28 | Bugbot PR #4 (7) + Security PR #5 (LLM keys / learnedFailures) → auto-fix |
| 2026-11-22 ~23:29 | PR #3 mergée (`d92795c`) — remint QR médical sur main |
| 2026-11-22 ~23:30 | PR #4 Bugbot fix `8fdd9bd` ; PR #5 security/Bugbot `5e9fc96` |
| 2026-11-22 ~23:37 | PR #5 questionnaire busy guard `3399694` |
| 2026-11-23 ~05:40 UTC | PR #5 Approval Agent OK ; mergée dans `main` (`6fdf9d153db1c88cede9c5f6c8d4a65babe1b6f7`) ; head branch conservée |
| 2026-11-23 ~05:41 UTC | Fin stream PR #5 ; blocker restant = deploy Firebase par Lorenzo (`FIREBASE-DEPLOY.md`) |
| 2026-11-23 ~05:48 UTC | Agent : `firebase deploy --only firestore:rules,firestore:indexes` → auth fail ; CDN wiring OK ; docs alternatives CI token / SA |
| 2026-11-23 ~05:49 UTC | Lorenzo login OK (local) ; agent re-try deploy → même auth fail (session non partagée) ; commande à lancer en local documentée |
| 2026-11-23 ~05:50 UTC | PR #7 mergée dans `main` — merge `6d9c4ab0b7b7ee423560990676bb2ffa1c19914b` — https://github.com/jejedu13376/urgency-the-road/pull/7 ; deploy Firestore toujours = Lorenzo local |
| 2026-11-23 ~05:55 UTC | UR-35 Multi-IA proxy code : PR #8 `cursor/multi-ia-server-proxy-da7d` — Firebase `multiIa` + docs secrets ; host live = Lorenzo |
| 2026-11-23 ~05:56 UTC | PR #8 Bugbot auto-fix : sanitize upstream errors ; heuristic si pas de token / 401·403·503 |
| 2026-11-23 ~06:00 UTC | UR-38 hosting restore : PR #9 ouverte ; EAS/Dev Client/BLE config + runbook ; `eas build` bloqué (pas Expo login) ; provisional download = GitHub Releases |
| 2026-11-23 ~06:17 UTC | Approval Agent OK tip `808fb73` ; PR #4 mergée (`1129ea4e3f082fd2e467c8002b68db1721045870`) — UR-27/28/29 livrés via #4 |
