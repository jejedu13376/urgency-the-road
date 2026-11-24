/**
 * Module 5 — free local DTC dictionary (paste / lookup without dongle).
 * Complements live BLE ELM327 reads — never invents a live hardware link.
 */
import type { ParsedDtc } from './elm327Protocol';

export type DtcDictionaryEntry = ParsedDtc & {
  repairGuide: string[];
};

const DICT: Record<string, DtcDictionaryEntry> = {
  P0300: {
    code: 'P0300',
    plainLanguage: 'Ratés d’allumage aléatoires / multiples cylindres.',
    severity: 'critical',
    repairGuide: ['Contrôler bougies / bobines', 'Vérifier compression', 'Lire misfire counts OBD'],
  },
  P0301: {
    code: 'P0301',
    plainLanguage: 'Raté d’allumage cylindre 1 — bougie, bobine ou injecteur.',
    severity: 'warn',
    repairGuide: ['Tester bobine cyl.1', 'Contrôler injecteur', 'Compression cyl.1'],
  },
  P0302: {
    code: 'P0302',
    plainLanguage: 'Raté d’allumage cylindre 2.',
    severity: 'warn',
    repairGuide: ['Permutation bobine', 'Contrôler faisceau'],
  },
  P0171: {
    code: 'P0171',
    plainLanguage: 'Mélange trop pauvre (banque 1).',
    severity: 'warn',
    repairGuide: ['Fuite admission', 'Capteur MAF / O2', 'Pression carburant'],
  },
  P0420: {
    code: 'P0420',
    plainLanguage: 'Efficacité catalyseur en dessous du seuil (banque 1).',
    severity: 'warn',
    repairGuide: ['Sondes O2 amont/aval', 'Échappement / catalyseur'],
  },
  P0113: {
    code: 'P0113',
    plainLanguage: 'Capteur température air admission — signal haut.',
    severity: 'info',
    repairGuide: ['Connecteur IAT', 'Faisceau / masse'],
  },
  P0562: {
    code: 'P0562',
    plainLanguage: 'Tension système basse (batterie / alternateur).',
    severity: 'critical',
    repairGuide: ['Mesurer batterie moteur off/on', 'Courroie alternateur', 'Chute de tension'],
  },
  U0100: {
    code: 'U0100',
    plainLanguage: 'Perte de communication avec l’ECM / PCM.',
    severity: 'critical',
    repairGuide: ['Alimentation calculateur', 'Bus CAN', 'Connecteur OBD'],
  },
  C0035: {
    code: 'C0035',
    plainLanguage: 'Capteur vitesse roue avant gauche (ABS).',
    severity: 'warn',
    repairGuide: ['Capteur ABS', 'Cible / roulement', 'Faisceau'],
  },
};

/** Normalize user paste: strip spaces, uppercase, keep P0xxx / C0xxx / U0xxx / B0xxx. */
export function normalizeDtcCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function lookupDtcCode(raw: string): DtcDictionaryEntry {
  const code = normalizeDtcCode(raw);
  const hit = DICT[code];
  if (hit) return hit;
  const severity: ParsedDtc['severity'] =
    code.startsWith('U') || code.startsWith('P0') && code.length === 5 ? 'warn' : 'info';
  return {
    code: code || '????',
    plainLanguage: code
      ? `Code ${code} — pas dans le dictionnaire local ; confirmez via valise BLE / doc constructeur.`
      : 'Code vide — collez un DTC (ex. P0301).',
    severity: code.startsWith('U') ? 'critical' : severity,
    repairGuide: ['Scanner OBD live (M5 BLE)', 'Croiser Multi-IA / pièces M3'],
  };
}

export function enrichParsedDtcs(codes: ParsedDtc[]): DtcDictionaryEntry[] {
  return codes.map((c) => {
    const hit = DICT[normalizeDtcCode(c.code)];
    if (hit) return hit;
    return {
      ...c,
      repairGuide: ['Confirmer via lecture live', 'Guide local absent pour ce code'],
    };
  });
}

export const DTC_DICT_LIVE =
  'Dictionnaire DTC local LIVE — collage manuel sans dongle ; lecture live = Dev Client + valise BLE.';
