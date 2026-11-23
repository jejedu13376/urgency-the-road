# Urgency Road — suivi

Dernière mise à jour : 2026-11-23 (UTC)

## Fait

- Clés PayPal rangées dans `.env` (`PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`) — ne pas coller dans le chat
- Clé YouTube rangée (`EXPO_PUBLIC_YOUTUBE_API_KEY`)
- Config Firebase web rangée (`EXPO_PUBLIC_FIREBASE_*` + alias `FIREBASE_*`) ; snippet CDN/npm dans `FIREBASE-CDN.md`
- PR #1 mergée dans `main` — merge `933be454ce03d3d784235709fcd54c132fa4d1fd` — https://github.com/jejedu13376/urgency-the-road/pull/1
- PR #2 mergée (`d654d59`) — SUIVI + gitignore
- PR #3 mergée (`d92795c`) — remint QR médical
- PR #5 mergée dans `main` — merge `6fdf9d153db1c88cede9c5f6c8d4a65babe1b6f7` — https://github.com/jejedu13376/urgency-the-road/pull/5
  - Docs deploy Firestore + `.firebaserc`
  - Multi-IA proxy-only + NHTSA recalls + Open-Meteo
  - Fil texte Firestore ; learnedFailures owner-only (pas de VIN)
  - Perf : YouTube cache, Firestore memory cache, icon compressée
- Formations en **standby** (site inchangé) ; 100 formations + optimisation **prévues** mais en pause
- BLE OBD + gate/spinner + hosting docs + perf : PR #4 (ouverte)

## Reste (Urgency Road)

- Déploiement des rules Firestore (`firebase deploy --only firestore:rules` — login Lorenzo requis ; voir `docs/FIREBASE-DEPLOY.md`)
- Proxy Multi-IA côté serveur (clés LLM jamais en `EXPO_PUBLIC_*`)
- Merge / finaliser PR #4 (BLE/gate/hosting/perf)
- Stubs restants : vidéo CDN, OBD BLE hardware, paiements (scaffolds sans faux succès)
- Build Dev Client pour BLE réel + dongle physique

## Décisions

- Stripe / Apple Pay / Google Pay : comptes marchands + clés encore côté Lorenzo (PayPal déjà noté)
- Formations ≠ Urgency Road (projets stricts séparés)
- CDN Firebase + `npm install firebase` notés pour réutilisation (`FIREBASE-CDN.md`)
- Bugbot : corriger automatiquement sur branche dédiée + push, sans attendre le feu vert
- Qualité d’abord (zéro régression) avant livraison
- Multi-IA live = `EXPO_PUBLIC_MULTI_IA_PROXY_URL` seulement (pas de clés provider dans le bundle)

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
| 2026-11-23 ~05:40 UTC | PR #5 Approval Agent OK ; mergée dans `main` (`6fdf9d1`) ; head branch conservée |
