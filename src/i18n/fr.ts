/** Français = langue par défaut de l'app. */
export const fr = {
  appName: 'Urgence Mécanique',
  tabMonVehicule: 'Mon véhicule',
  tabDiagnostic: 'Diagnostic',
  tabCarte: 'Carte',
  tabFil: 'Fil méca',
  tabMenu: 'Menu',
  stub: 'STUB — service non connecté',
  stubVin: 'VIN — NHTSA vPIC live ; fluides locaux ; recalls NHTSA ; pas d’API fluides OEM',
  stubObd: 'STUB OBD — pas de liaison Bluetooth/USB réelle (valise / Dev Client)',
  stubAi: 'Multi-IA — heuristique croisée ; proxy/clés optionnels',
  stubPay: 'Paiement — Stripe / PayPal / Apple Pay / Google Pay (pas de Lydia)',
  stubGps: 'STUB GPS — transfert apps réel ; pas de graphe ponts/PTAC live',
  stubWeather: 'Météo LIVE Open-Meteo (cache 10 min)',
  stubQuote: 'Devis — OCR-lite texte / saisie manuelle / heuristique (OCR ML Kit non branché)',
} as const;

export type FrKey = keyof typeof fr;
