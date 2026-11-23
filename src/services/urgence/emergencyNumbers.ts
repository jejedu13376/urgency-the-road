/**
 * Regional emergency dial numbers for Module 13 SOS.
 * All options stay visible; locale/GPS only highlights a suggestion.
 */

export type EmergencyRegionId = 'universal' | 'europe' | 'australia' | 'north_america';

export type EmergencyNumberOption = {
  id: EmergencyRegionId;
  /** Short region label shown on the dial button. */
  regionLabel: string;
  /** Dial digits (no spaces). */
  number: string;
  /** Longer helper under the number. */
  hint: string;
};

/** Always show every option — never filter by locale. */
export const EMERGENCY_NUMBERS: readonly EmergencyNumberOption[] = [
  {
    id: 'universal',
    regionLabel: 'Universal (GSM)',
    number: '112',
    hint: 'Works wherever GSM emergency routing supports 112',
  },
  {
    id: 'europe',
    regionLabel: 'Europe',
    number: '112',
    hint: 'EU / EEA emergency number',
  },
  {
    id: 'australia',
    regionLabel: 'Australia',
    number: '000',
    hint: 'Australia triple-zero',
  },
  {
    id: 'north_america',
    regionLabel: 'North America',
    number: '911',
    hint: 'US / Canada / Mexico common emergency',
  },
] as const;

export type CoarseEmergencyRegion = 'EU' | 'NA' | 'AU';

const NA_REGION_CODES = new Set([
  'US',
  'CA',
  'MX',
  'PR',
  'VI',
  'GU',
  'AS',
  'MP',
]);

const AU_REGION_CODES = new Set(['AU', 'NZ', 'NF', 'CX', 'CC']);

/** Map ISO 3166-1 alpha-2 (or similar) to a coarse emergency region. */
export function coarseRegionFromCountryCode(code?: string | null): CoarseEmergencyRegion | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (!c) return null;
  if (NA_REGION_CODES.has(c)) return 'NA';
  if (AU_REGION_CODES.has(c)) return 'AU';
  // Most other ISO regions default to Europe/112-style suggestion when unknown NA/AU.
  return 'EU';
}

/** Coarse region from WGS84 — same heuristics as weigh-station OSM helpers. */
export function coarseRegionFromLatLon(lat: number, lon: number): CoarseEmergencyRegion {
  if (lat < -10 && lon > 110 && lon < 180) return 'AU';
  if (lat > 15 && lon > -170 && lon < -50) return 'NA';
  return 'EU';
}

/** Best-effort device region from Intl locale (no native localization dependency). */
export function deviceRegionCodeFromIntl(): string | null {
  try {
    const locale =
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().locale
        : undefined;
    if (!locale) return null;
    const parts = locale.replace(/_/g, '-').split('-');
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      if (/^[A-Za-z]{2}$/.test(last)) return last.toUpperCase();
      // e.g. en-US-u-… → take second segment
      if (/^[A-Za-z]{2}$/.test(parts[1])) return parts[1].toUpperCase();
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type SuggestEmergencyArgs = {
  /** Device/GPS coords when available — preferred over locale. */
  lat?: number | null;
  lon?: number | null;
  /** ISO country / region code override (tests / prefs). */
  regionCode?: string | null;
};

/**
 * Suggest which listed option to highlight.
 * Preference: GPS → explicit regionCode → Intl locale → Universal GSM 112.
 * Never hides other options.
 */
export function suggestEmergencyNumberId(args: SuggestEmergencyArgs = {}): EmergencyRegionId {
  let coarse: CoarseEmergencyRegion | null = null;

  if (
    typeof args.lat === 'number' &&
    Number.isFinite(args.lat) &&
    typeof args.lon === 'number' &&
    Number.isFinite(args.lon)
  ) {
    coarse = coarseRegionFromLatLon(args.lat, args.lon);
  } else {
    coarse = coarseRegionFromCountryCode(args.regionCode ?? deviceRegionCodeFromIntl());
  }

  if (coarse === 'NA') return 'north_america';
  if (coarse === 'AU') return 'australia';
  if (coarse === 'EU') return 'europe';
  return 'universal';
}

export function emergencyOptionById(id: EmergencyRegionId): EmergencyNumberOption {
  return EMERGENCY_NUMBERS.find((o) => o.id === id) ?? EMERGENCY_NUMBERS[0];
}
