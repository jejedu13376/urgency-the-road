/** Français = langue par défaut de l'app. */
export const fr = {
  appName: 'Urgence Mécanique',
  tabMonVehicule: 'Mon véhicule',
  tabDiagnostic: 'Diagnostic',
  tabCarte: 'Carte',
  tabFil: 'Fil méca',
  tabMenu: 'Menu',
  stub: 'STUB — service non connecté',
  stubVin: 'STUB VIN — décodage local mock, pas d’API constructeur live',
  stubObd: 'STUB OBD — pas de liaison Bluetooth/USB réelle',
  stubAi: 'STUB IA — réponses mock, pas de Claude/GPT/Gemini live',
  stubPay: 'STUB paiement — Lydia/Stripe/Apple Pay/Google Pay non branchés',
  stubGps: 'STUB GPS — carte mock, pas de trafic live poids lourd',
  stubWeather: 'STUB météo — valeurs locales mock',
} as const;

export type FrKey = keyof typeof fr;
