import type { VehicleProfile } from '../types/vehicle';
import type {
  DtcCode,
  FeedPost,
  MaintenanceItem,
  PartQuote,
  PlacePin,
  SubscriptionPlan,
  TutorialItem,
} from '../types/modules';
import { hintFromWmi, normalizeVin, vinCheckDigitOk } from '../services/vin/vinNormalize';

export const MOCK_FLEET: VehicleProfile[] = [
  {
    id: 'v-clio',
    label: 'Clio perso',
    vin: 'VF1RJA00067000001',
    continent: 'EU',
    country: 'FR',
    make: 'Renault',
    model: 'Clio V',
    year: 2021,
    powertrain: 'essence',
    vehicleClass: 'voiture',
    fluids: { engineOilL: 4.5, coolantL: 5.2, washerL: 3.5, fuelL: 42 },
    commonFailures: [
      {
        id: 'f1',
        title: 'Capteur PMH intermittent',
        symptoms: ['calage à chaud', 'voyant moteur'],
        severity: 'moyen',
      },
    ],
    odometerKm: 68420,
    unitSystem: 'metric',
    currency: 'EUR',
  },
  {
    id: 'v-f150',
    label: 'F-150 chantier',
    vin: '1FTFW1E50MFA00002',
    continent: 'NA',
    country: 'CA',
    make: 'Ford',
    model: 'F-150',
    year: 2021,
    powertrain: 'essence',
    vehicleClass: 'pickup',
    fluids: { engineOilL: 7.6, coolantL: 15, washerL: 4.5, fuelL: 98 },
    commonFailures: [
      {
        id: 'f2',
        title: 'Camphaser (phasage AAC)',
        symptoms: ['cliquetis au démarrage', 'ralenti irrégulier'],
        severity: 'eleve',
      },
    ],
    odometerKm: 112300,
    unitSystem: 'imperial',
    currency: 'CAD',
  },
  {
    id: 'v-actros',
    label: 'Actros flotte',
    vin: 'WDB9634031L000003',
    continent: 'EU',
    country: 'DE',
    make: 'Mercedes-Benz',
    model: 'Actros 1845',
    year: 2019,
    powertrain: 'poids_lourd_diesel',
    vehicleClass: 'poids_lourd',
    fluids: { engineOilL: 32, coolantL: 48, washerL: 12, fuelL: 690 },
    commonFailures: [
      {
        id: 'f3',
        title: 'Capteur NOx amont',
        symptoms: ['mode dégradé', 'consommation AdBlue↑'],
        severity: 'eleve',
      },
    ],
    odometerKm: 482000,
    unitSystem: 'metric',
    currency: 'EUR',
  },
];

export const CASCADE = {
  continents: [
    { id: 'EU', label: 'Europe' },
    { id: 'NA', label: 'Amérique du Nord' },
    { id: 'AU', label: 'Australie' },
    { id: 'AS', label: 'Asie' },
  ],
  countries: {
    EU: ['FR', 'DE', 'ES', 'IT', 'BE'],
    NA: ['CA', 'US'],
    AU: ['AU'],
    AS: ['JP', 'KR', 'CN'],
  } as Record<string, string[]>,
  makes: {
    FR: ['Renault', 'Peugeot', 'Citroën'],
    DE: ['Mercedes-Benz', 'Volkswagen', 'BMW'],
    ES: ['SEAT', 'Renault', 'Peugeot'],
    IT: ['Fiat', 'Iveco', 'Ferrari'],
    BE: ['Volkswagen', 'Peugeot', 'Renault'],
    CA: ['Ford', 'GM', 'Toyota'],
    US: ['Ford', 'Chevrolet', 'Ram'],
    AU: ['Toyota', 'Holden', 'Ford'],
    JP: ['Toyota', 'Honda', 'Nissan'],
    KR: ['Hyundai', 'Kia', 'Genesis'],
    CN: ['BYD', 'Geely', 'Toyota'],
  } as Record<string, string[]>,
  models: {
    Renault: ['Clio V', 'Megane', 'Master'],
    Peugeot: ['208', '3008', 'Boxer'],
    Citroën: ['C3', 'Berlingo', 'Jumper'],
    Ford: ['F-150', 'F-350', 'Transit'],
    'Mercedes-Benz': ['Actros 1845', 'Sprinter', 'Classe C'],
    Volkswagen: ['Golf', 'Transporter', 'Crafter'],
    BMW: ['Serie 3', 'X5', 'iX'],
    Toyota: ['Hilux', 'Corolla', 'Land Cruiser'],
    GM: ['Sierra', 'Silverado', 'Canyon'],
    Chevrolet: ['Silverado', 'Tahoe', 'Bolt'],
    Ram: ['1500', '2500', 'ProMaster'],
    Holden: ['Colorado', 'Commodore'],
    Honda: ['Civic', 'CR-V', 'Accord'],
    Nissan: ['Navara', 'Qashqai', 'Leaf'],
    SEAT: ['Ibiza', 'Leon', 'Ateca'],
    Fiat: ['500', 'Ducato', 'Panda'],
    Iveco: ['S-Way', 'Daily', 'Eurocargo'],
    Ferrari: ['Roma', 'SF90'],
    Hyundai: ['i30', 'Tucson', 'Ioniq 5'],
    Kia: ['Ceed', 'Sportage', 'EV6'],
    Genesis: ['G70', 'GV80'],
    BYD: ['Atto 3', 'Seal', 'Han'],
    Geely: ['Coolray', 'Geometry C'],
  } as Record<string, string[]>,
  years: [2024, 2023, 2022, 2021, 2020, 2019, 2018],
  powertrains: ['essence', 'diesel', 'hybride', 'electrique', 'gpl', 'poids_lourd_diesel'],
};

export const MOCK_PARTS: PartQuote[] = [
  {
    id: 'p1',
    name: 'Filtre à huile',
    category: 'filtre',
    oemSku: 'OE-15400',
    priceNew: 18,
    priceOem: 24,
    priceAftermarket: 12,
    laborHours: 0.2,
    laborRate: 85,
    currency: 'EUR',
    region: 'EU-FR',
  },
  {
    id: 'p2',
    name: 'Plaquettes avant',
    category: 'mecanique',
    oemSku: 'OE-BRK-F',
    priceNew: 78,
    priceOem: 110,
    priceAftermarket: 55,
    laborHours: 1.2,
    laborRate: 85,
    currency: 'EUR',
    region: 'EU-FR',
  },
  {
    id: 'p3',
    name: 'Capteur NOx',
    category: 'electrique',
    oemSku: 'A0009053109',
    priceNew: 420,
    priceOem: 580,
    priceAftermarket: 310,
    laborHours: 1.8,
    laborRate: 110,
    currency: 'EUR',
    region: 'EU-DE',
  },
];

export const MOCK_DTC: DtcCode[] = [
  {
    code: 'P0301',
    plainLanguage: 'Raté d’allumage cylindre 1 — bougie, bobine ou injecteur à contrôler.',
    severity: 'warn',
    repairGuide: ['Lire les misfires', 'Tester bobine cyl.1', 'Contrôler compression'],
  },
  {
    code: 'SPN 3226 FMI 2',
    plainLanguage: 'Signal NOx incohérent (protocole J1939 poids lourd).',
    severity: 'critical',
    repairGuide: ['Vérifier faisceau NOx', 'Contrôler AdBlue', 'Effacer après réparation'],
  },
];

export const MOCK_PLACES: PlacePin[] = [
  {
    id: 'g1',
    kind: 'garage',
    name: 'Atelier Nord Mécanique',
    address: '12 rue des Ateliers, Lille',
    phone: '+33320000001',
    hours: 'Lun–Ven 8h–18h',
    distanceKm: 2.4,
    etaMin: 9,
    lat: 50.63,
    lon: 3.06,
  },
  {
    id: 'd1',
    kind: 'depannage',
    name: 'Dépanneuse Express 24/7',
    address: 'Zone A7, sortie 12',
    phone: '+33600000002',
    hours: '24/7',
    distanceKm: 5.1,
    etaMin: 18,
    lat: 50.61,
    lon: 3.1,
  },
  {
    id: 'p1',
    kind: 'pieces',
    name: 'Pièces Auto Hub',
    address: 'Parc logistique, Roubaix',
    phone: '+33320000003',
    hours: 'Lun–Sam 8h–19h',
    distanceKm: 7.8,
    etaMin: 22,
    lat: 50.69,
    lon: 3.17,
  },
  {
    id: 'w1',
    kind: 'pesage',
    name: 'Poste de pesage A25',
    address: 'Aire de Lomme',
    phone: 'N/A',
    hours: 'Variable',
    distanceKm: 14,
    etaMin: 16,
    lat: 50.65,
    lon: 2.99,
  },
  {
    id: 'pl1',
    kind: 'depot_pl',
    name: 'Dépôt PL CamionParts',
    address: 'ZI Portuaire',
    phone: '+33320000004',
    hours: 'Lun–Ven 7h–20h',
    distanceKm: 11,
    etaMin: 20,
    lat: 50.64,
    lon: 3.12,
  },
];

export const MOCK_MAINTENANCE: MaintenanceItem[] = [
  { id: 'm1', title: 'Vidange + filtre', dueKm: 70000, status: 'a_faire' },
  { id: 'm2', title: 'Freins avant', dueKm: 72000, status: 'planifie' },
  { id: 'm3', title: 'Contrôle technique (FR)', dueDateIso: '2027-03-01', dueKm: 90000, status: 'planifie' },
  { id: 'm4', title: 'Assurance — renouvellement', dueDateIso: '2026-12-15', dueKm: 999999, status: 'a_faire' },
];

export const MOCK_TUTORIALS: TutorialItem[] = [
  {
    id: 't1',
    title: 'Remplacer plaquettes avant',
    make: 'Renault',
    model: 'Clio V',
    durationMin: 45,
    steps: ['Sécuriser le véhicule', 'Retirer l’étrier', 'Poser plaquettes neuves', 'Repomper frein'],
  },
  {
    id: 't2',
    title: 'Filtre à gasoil PL',
    make: 'Mercedes-Benz',
    model: 'Actros',
    durationMin: 35,
    steps: ['Purger', 'Déposer filtre', 'Lubrifier joint', 'Amorcer circuit'],
  },
];

export const MOCK_FEED: FeedPost[] = [
  {
    id: 'fp1',
    author: 'GarageLéa',
    title: 'Fuite turbo — joint collecteur',
    caption: 'Astuce couple de serrage et pâte étanchéité.',
    likes: 128,
    comments: 14,
    createdAt: '2026-11-22T10:00:00Z',
  },
  {
    id: 'fp2',
    author: 'RoutierTom',
    title: 'AdBlue cristallisé',
    caption: 'Nettoyage vanne et prévention hiver.',
    likes: 86,
    comments: 9,
    createdAt: '2026-11-21T18:22:00Z',
  },
];

export const MOCK_PLANS: SubscriptionPlan[] = [
  {
    id: 'particulier',
    name: 'Particulier',
    priceMonthly: 9.9,
    currency: 'EUR',
    perks: ['1 véhicule', 'Diagnostic photo stub', 'Carnet numérique'],
  },
  {
    id: 'routier_pro',
    name: 'Routier Pro',
    priceMonthly: 24.9,
    currency: 'EUR',
    perks: ['GPS PL', 'Pesage', 'Multi-IA stub', '2 véhicules'],
  },
  {
    id: 'flotte',
    name: 'Flotte',
    priceMonthly: 79,
    currency: 'EUR',
    perks: ['Flotte illimitée', 'Espace Pro', 'Exports PDF', 'Admin atelier'],
  },
];

/** Cascading VIN mock decode — WMI heuristics when NHTSA is offline (not an OEM API). */
export function mockDecodeVin(vin: string): VehicleProfile | null {
  const clean = normalizeVin(vin);
  if (clean.length < 11) return null;
  const hit = MOCK_FLEET.find((v) => v.vin === clean);
  if (hit) return { ...hit, id: `decoded-${Date.now()}`, label: `${hit.make} ${hit.model}` };

  const hint = hintFromWmi(clean);
  const check = vinCheckDigitOk(clean);
  const year = 2000 + (parseInt(clean.slice(-2), 36) % 25);
  const powertrain = hint.powertrainHint ?? 'essence';
  const vehicleClass = hint.vehicleClassHint ?? 'voiture';
  return {
    id: `decoded-${Date.now()}`,
    label: `${hint.make} (WMI mock) ${year}`,
    vin: clean,
    continent: hint.continent,
    country: hint.country,
    make: hint.make,
    model: 'Modèle estimé (hors NHTSA)',
    year,
    powertrain,
    vehicleClass,
    fluids:
      vehicleClass === 'poids_lourd'
        ? { engineOilL: 32, coolantL: 45, washerL: 12, fuelL: 600 }
        : { engineOilL: 5, coolantL: 6, washerL: 3, fuelL: 50 },
    commonFailures: [
      {
        id: 'gen',
        title: 'Fallback WMI local',
        symptoms: [
          'NHTSA indisponible — estimation par préfixe VIN',
          check === false ? 'Chiffre de contrôle VIN invalide (ISO 3779)' : 'Préfixe WMI reconnu',
        ],
        severity: check === false ? 'moyen' : 'faible',
      },
    ],
    odometerKm: 0,
    unitSystem: hint.continent === 'NA' ? 'imperial' : 'metric', // AU = metric
    currency:
      hint.continent === 'NA' ? (hint.country === 'CA' ? 'CAD' : 'USD') : hint.continent === 'AU' ? 'AUD' : 'EUR',
  };
}
