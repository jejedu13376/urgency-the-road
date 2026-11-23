# Améliorations (optimisation code existant) — Urgence Road

Sans réécriture. Branche PR #1 `cursor/firebase-youtube-env-e72c`.

1. **VIN** — helper commun `vinNormalize` (normalisation + chiffre de contrôle ISO 3779).
2. **VIN NHTSA** — messages plus clairs ; alerte si check digit invalide.
3. **Fallback VIN** — table WMI enrichie (Renault, Mercedes, Ford, Toyota…) au lieu d’un mock générique.
4. **Scan caméra VIN** — saisie manuelle si caméra refusée / code illisible.
5. **Pièces** — catalogue mock filtré par WMI/make du véhicule actif ; liens d’achat Google recherche OEM.
6. **Devis OCR stub** — heuristique anti-arnaque vs marché local (photo/PDF), ancrée VIN/make/SKU sélectionné.
7. **Quotes Firestore** — ownerUid = compte connecté ; mock si non connecté.
8. **Labels FR / stubs** — VIN live NHTSA, paiements sans Lydia, OCR devis explicite.
9. **UI** — libellés Mon véhicule / Diagnostic / Pièces alignés sur le comportement réel.

Formations : non touché.
