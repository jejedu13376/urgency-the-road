/**
 * Shared VIN normalize + lightweight check-digit (ISO 3779).
 * Used by NHTSA path, mock fallback, and camera scanner.
 */

const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeVin(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
}

/** Returns null if format OK / too short to check; false if 17-char check digit fails. */
export function vinCheckDigitOk(vin: string): boolean | null {
  if (vin.length !== 17) return null;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const n = TRANSLITERATION[vin[i]];
    if (n === undefined) return false;
    sum += n * WEIGHTS[i];
  }
  const rem = sum % 11;
  const expected = rem === 10 ? 'X' : String(rem);
  return vin[8] === expected;
}

export type WmiHint = {
  make: string;
  country: string;
  continent: 'EU' | 'NA' | 'AS' | 'AU';
  powertrainHint?: 'essence' | 'diesel' | 'poids_lourd_diesel';
  vehicleClassHint?: 'voiture' | 'pickup' | 'poids_lourd' | 'suv';
};

/** Common WMI prefixes — strengthens mock decode when NHTSA is offline. */
export function hintFromWmi(vin: string): WmiHint {
  const w = vin.slice(0, 3);
  const table: Record<string, WmiHint> = {
    VF1: { make: 'Renault', country: 'FR', continent: 'EU' },
    VF3: { make: 'Peugeot', country: 'FR', continent: 'EU' },
    VF7: { make: 'Citroën', country: 'FR', continent: 'EU' },
    WDB: { make: 'Mercedes-Benz', country: 'DE', continent: 'EU', powertrainHint: 'poids_lourd_diesel', vehicleClassHint: 'poids_lourd' },
    WDD: { make: 'Mercedes-Benz', country: 'DE', continent: 'EU' },
    WVW: { make: 'Volkswagen', country: 'DE', continent: 'EU' },
    WAU: { make: 'Audi', country: 'DE', continent: 'EU' },
    WBA: { make: 'BMW', country: 'DE', continent: 'EU' },
    SAJ: { make: 'Jaguar', country: 'GB', continent: 'EU' },
    SAL: { make: 'Land Rover', country: 'GB', continent: 'EU', vehicleClassHint: 'suv' },
    ZFA: { make: 'Fiat', country: 'IT', continent: 'EU' },
    ZFF: { make: 'Ferrari', country: 'IT', continent: 'EU' },
    JTD: { make: 'Toyota', country: 'JP', continent: 'AS' },
    JN1: { make: 'Nissan', country: 'JP', continent: 'AS' },
    JM1: { make: 'Mazda', country: 'JP', continent: 'AS' },
    KMH: { make: 'Hyundai', country: 'KR', continent: 'AS' },
    '1FT': { make: 'Ford', country: 'US', continent: 'NA', vehicleClassHint: 'pickup' },
    '1FA': { make: 'Ford', country: 'US', continent: 'NA' },
    '1G1': { make: 'Chevrolet', country: 'US', continent: 'NA' },
    '2HG': { make: 'Honda', country: 'CA', continent: 'NA' },
    '3VW': { make: 'Volkswagen', country: 'MX', continent: 'NA' },
    '6FP': { make: 'Ford', country: 'AU', continent: 'AU' },
  };
  if (table[w]) return table[w];
  // 2-char fallbacks
  if (vin.startsWith('VF')) return { make: 'PSA/Renault groupe', country: 'FR', continent: 'EU' };
  if (vin.startsWith('WD')) return { make: 'Mercedes-Benz', country: 'DE', continent: 'EU' };
  if (vin.startsWith('1') || vin.startsWith('4') || vin.startsWith('5')) {
    return { make: 'OEM Amérique du Nord', country: 'US', continent: 'NA' };
  }
  if (vin.startsWith('J')) return { make: 'OEM Japon', country: 'JP', continent: 'AS' };
  if (vin.startsWith('6')) return { make: 'OEM Australie', country: 'AU', continent: 'AU' };
  return { make: 'Générique', country: 'FR', continent: 'EU' };
}
