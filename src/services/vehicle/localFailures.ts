/**
 * Module 1 — local common-failure catalogue (free path).
 * Seeded by make / powertrain / class — not OEM TSB API.
 */
import type { CommonFailure, Powertrain, VehicleClass } from '../../types/vehicle';

export type FailuresInput = {
  make: string;
  powertrain: Powertrain;
  vehicleClass: VehicleClass;
  /** Extra symptoms from NHTSA decode (body, plant, check digit) */
  nhtsaHints?: string[];
};

const BY_MAKE: Record<string, CommonFailure[]> = {
  renault: [
    {
      id: 'loc-ren-pmh',
      title: 'Capteur PMH / vilebrequin intermittent',
      symptoms: ['calage à chaud', 'voyant moteur', 'démarrage difficile'],
      severity: 'moyen',
    },
  ],
  peugeot: [
    {
      id: 'loc-psa-fap',
      title: 'FAP / régénération incomplète',
      symptoms: ['perte de puissance', 'voyant antipollution', 'trajets courts'],
      severity: 'moyen',
    },
  ],
  citroen: [
    {
      id: 'loc-cit-fap',
      title: 'FAP / vanne EGR encrassée',
      symptoms: ['à-coups', 'fumée noire', 'voyant moteur'],
      severity: 'moyen',
    },
  ],
  ford: [
    {
      id: 'loc-ford-cam',
      title: 'Phasage AAC / camphaser',
      symptoms: ['cliquetis au démarrage', 'ralenti irrégulier'],
      severity: 'eleve',
    },
  ],
  'mercedes-benz': [
    {
      id: 'loc-mb-nox',
      title: 'Capteur NOx / AdBlue (diesel / PL)',
      symptoms: ['mode dégradé', 'consommation AdBlue↑', 'code NOx'],
      severity: 'eleve',
    },
  ],
  volkswagen: [
    {
      id: 'loc-vw-dsG',
      title: 'Mechatronique DSG / double embrayage',
      symptoms: ['à-coups en 1–2', 'passage dur', 'voyants boîte'],
      severity: 'eleve',
    },
  ],
  toyota: [
    {
      id: 'loc-toy-hybrid',
      title: 'Batterie HV / onduleur (hybride)',
      symptoms: ['perte d’assistance électrique', 'voyants hybrides'],
      severity: 'moyen',
    },
  ],
  chevrolet: [
    {
      id: 'loc-chevy-afm',
      title: 'AFM / cylindres désactivés',
      symptoms: ['bruit soupapes', 'consommation↑', 'voyants moteur'],
      severity: 'moyen',
    },
  ],
  honda: [
    {
      id: 'loc-honda-ac',
      title: 'VTEC / solénoïde huile',
      symptoms: ['perte de puissance haut régime', 'code VTEC'],
      severity: 'faible',
    },
  ],
  bmw: [
    {
      id: 'loc-bmw-vanos',
      title: 'VANOS / joint de cache-culbuteurs',
      symptoms: ['fuite d’huile', 'ralenti irrégulier'],
      severity: 'moyen',
    },
  ],
};

const BY_POWERTRAIN: Partial<Record<Powertrain, CommonFailure>> = {
  diesel: {
    id: 'loc-dsl-egr',
    title: 'EGR / turbo encrassé (diesel)',
    symptoms: ['manque de couple', 'fumée', 'voyant antipollution'],
    severity: 'moyen',
  },
  electrique: {
    id: 'loc-ev-charge',
    title: 'Connecteur charge / BMS',
    symptoms: ['charge interrompue', 'autonomie↓', 'voyants HV'],
    severity: 'moyen',
  },
  hybride: {
    id: 'loc-hyb-batt',
    title: 'Batterie traction / convertisseur',
    symptoms: ['passage essence forcé', 'bruit onduleur'],
    severity: 'moyen',
  },
  poids_lourd_diesel: {
    id: 'loc-pl-scr',
    title: 'SCR / AdBlue / NOx (poids lourd)',
    symptoms: ['derate', 'codes J1939 NOx', 'AdBlue cristallisé'],
    severity: 'eleve',
  },
};

function makeKey(make: string): string {
  return make
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Build a short local failure list for the fiche technique.
 * Always honest that this is not an OEM TSB feed.
 */
export function buildLocalCommonFailures(input: FailuresInput): CommonFailure[] {
  const key = makeKey(input.make);
  const out: CommonFailure[] = [];

  for (const [mk, list] of Object.entries(BY_MAKE)) {
    if (key.includes(mk) || mk.includes(key.split(' ')[0] ?? '')) {
      out.push(...list);
      break;
    }
  }

  const pt = BY_POWERTRAIN[input.powertrain];
  if (pt && !out.some((f) => f.id === pt.id)) out.push(pt);

  if (input.vehicleClass === 'poids_lourd' && !out.some((f) => f.id.startsWith('loc-pl') || f.id.startsWith('loc-mb'))) {
    out.push({
      id: 'loc-pl-gen',
      title: 'Entretien PL (freins / pneumatiques / AdBlue)',
      symptoms: ['usure freins', 'pression pneus', 'AdBlue'],
      severity: 'faible',
    });
  }

  const hints = (input.nhtsaHints ?? []).filter(Boolean);
  out.push({
    id: 'loc-src',
    title: 'Source locale (pas d’API TSB OEM)',
    symptoms: hints.length
      ? hints
      : ['Catalogue pannes fréquent local — croiser OBD / Multi-IA / recalls NHTSA'],
    severity: 'faible',
  });

  return out.slice(0, 5);
}
