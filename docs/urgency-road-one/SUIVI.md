# Urgency Road — suivi

Dernière mise à jour : 2026-11-22 (America/Edmonton)

## Fait

- Clés PayPal rangées dans `.env` (`PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`) — ne pas coller dans le chat
- Clé YouTube rangée (`EXPO_PUBLIC_YOUTUBE_API_KEY`) + `ENV-YOUTUBE.env`
- Config Firebase web rangée (`EXPO_PUBLIC_FIREBASE_*` + alias `FIREBASE_*`) ; snippet CDN/npm dans `FIREBASE-CDN.md`
- PR #1 mergée dans `main` — merge `933be454ce03d3d784235709fcd54c132fa4d1fd` — https://github.com/jejedu13376/urgency-the-road/pull/1
- Formations en **standby** (site inchangé) ; 100 formations + optimisation **prévues** mais en pause
- Bugbot : correction auto activée (sans confirmation) ; follow-up en cours

## Reste (Urgency Road)

- Déploiement des rules Firestore (`firebase deploy --only firestore:rules` — peut exiger login Lorenzo)
- Stubs des 17 modules → backends live
- Multi-IA
- BLE OBD (valise)
- Verrou de démarrage (StartupGate + spinner rouge)
- Restauration d’hébergement
- Optimisation app (bundle, UI, latence Firebase/YouTube)
- Correction des flags Bugbot restants (PR de suivi)

## Décisions

- Stripe / Apple Pay / Google Pay : comptes marchands + clés encore côté Lorenzo (PayPal déjà noté)
- Formations ≠ Urgency Road (projets stricts séparés)
- CDN Firebase + `npm install firebase` notés pour réutilisation (`FIREBASE-CDN.md`)
- Bugbot : corriger automatiquement sur branche dédiée + push, sans attendre le feu vert
- Qualité d’abord (zéro régression) avant livraison

## Journal

| Quand (Edmonton) | Événement |
| --- | --- |
| 2026-11-22 ~23:13 | PR #1 mergée (`933be45`) |
| 2026-11-22 ~23:14 | Formations standby ; focus Urgency Road |
| 2026-11-22 ~23:15 | Optimisation app ajoutée aux priorités |
| 2026-11-22 ~23:18 | Ce fichier `SUIVI.md` créé ; sauvegarde GitHub demandée |
