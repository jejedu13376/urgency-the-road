/** Français = langue par défaut de l'app. */
export const fr = {
  appName: 'Urgence Mécanique',
  tabMonVehicule: 'Mon véhicule',
  tabDiagnostic: 'Diagnostic',
  tabCarte: 'Carte',
  tabFil: 'Fil méca',
  tabMenu: 'Menu',
  stub: 'STUB — service non connecté',
  stubVin: 'VIN — NHTSA vPIC live ; fallback WMI local si réseau KO',
  stubObd: 'STUB OBD — pas de liaison Bluetooth/USB réelle (valise / Dev Client)',
  stubAi: 'STUB IA — réponses mock, pas de Claude/GPT/Gemini live',
  stubPay: 'Paiement — Stripe / PayPal / Apple Pay / Google Pay (pas de Lydia)',
  stubGps: 'STUB GPS — transfert apps réel ; pas de graphe ponts/PTAC live',
  stubWeather: 'STUB météo — valeurs locales mock',
  stubQuote: 'STUB OCR devis — heuristique marché local (pas d’OCR ML Kit encore)',
} as const;

export type FrKey = keyof typeof fr;
