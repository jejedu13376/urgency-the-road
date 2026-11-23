/**
 * Hours-of-Service (HOS) regional profiles for fatigue scoring.
 * Limits are simplified guidance defaults — see docs/urgency-road-hos-regs.md.
 * Not a certified ELD / legal compliance engine.
 */

export type HosRegionId = 'CA' | 'US' | 'EU' | 'AU';

export type HosLimits = {
  id: HosRegionId;
  label: string;
  /** Max driving (or AU “work”) seconds in the primary daily / shift window. */
  maxDriveSec: number;
  /** Continuous driving before a mandatory break is due. */
  breakAfterDriveSec: number;
  /** Minimum break length (seconds). */
  minBreakSec: number;
  /** Optional on-duty / work-shift window (US 14h, CA 16h). */
  dutyWindowSec?: number;
  /** Weekly on-duty or driving cap (seconds). */
  weeklyCapSec: number;
  /** Fraction of a cap at which we warn (near limit). */
  warnRatio: number;
  citation: string;
};

const H = (n: number) => Math.round(n * 3600);
const M = (n: number) => Math.round(n * 60);

/** Official-inspired defaults used by fatigueScore + SafetyDrivingMonitor. */
export const HOS_LIMITS: Record<HosRegionId, HosLimits> = {
  CA: {
    id: 'CA',
    label: 'Canada (SOR/2005-313, south of 60°N)',
    maxDriveSec: H(13),
    breakAfterDriveSec: H(8),
    minBreakSec: M(30),
    dutyWindowSec: H(16),
    weeklyCapSec: H(70),
    warnRatio: 0.85,
    citation: 'https://laws-lois.justice.gc.ca/eng/regulations/SOR-2005-313/fulltext.html',
  },
  US: {
    id: 'US',
    label: 'United States (49 CFR § 395.3 property)',
    maxDriveSec: H(11),
    breakAfterDriveSec: H(8),
    minBreakSec: M(30),
    dutyWindowSec: H(14),
    weeklyCapSec: H(70),
    warnRatio: 0.85,
    citation: 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395/subpart-A/section-395.3',
  },
  EU: {
    id: 'EU',
    label: 'European Union (EC 561/2006)',
    maxDriveSec: H(9),
    breakAfterDriveSec: H(4.5),
    minBreakSec: M(45),
    weeklyCapSec: H(56),
    warnRatio: 0.85,
    citation: 'https://eur-lex.europa.eu/eli/reg/2006/561/oj/eng',
  },
  AU: {
    id: 'AU',
    label: 'Australia (NHVR Standard Hours solo)',
    maxDriveSec: H(12),
    breakAfterDriveSec: H(5.25),
    minBreakSec: M(15),
    weeklyCapSec: H(72),
    warnRatio: 0.85,
    citation: 'https://www.nhvr.gov.au/safety-accreditation-compliance/fatigue-management/work-and-rest-hours',
  },
};

const EU_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'EL',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'CH',
  'GB',
  'UK',
]);

export function hosRegionFromCountryCode(code?: string | null): HosRegionId | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (!c) return null;
  if (c === 'CA') return 'CA';
  if (c === 'US' || c === 'USA' || c === 'PR' || c === 'VI' || c === 'GU') return 'US';
  if (c === 'AU' || c === 'NZ') return 'AU';
  if (EU_COUNTRY_CODES.has(c)) return 'EU';
  if (c === 'MX') return 'US'; // closest NA property-CMV default for app guidance
  return null;
}

/**
 * Coarse GPS → HOS region.
 * NA split: lat ≥ 49 → Canada (49th parallel heuristic); else US.
 */
export function hosRegionFromLatLon(lat: number, lon: number): HosRegionId {
  if (lat < -10 && lon > 110 && lon < 180) return 'AU';
  if (lat > 15 && lon > -170 && lon < -50) {
    return lat >= 49 ? 'CA' : 'US';
  }
  return 'EU';
}

export type ResolveHosOpts = {
  /** Explicit user/country selection — highest priority. */
  explicit?: HosRegionId | null;
  countryCode?: string | null;
  lat?: number | null;
  lon?: number | null;
  /** Vehicle continent hint when nothing else is known. */
  continent?: 'NA' | 'EU' | 'AU' | 'AS' | null;
};

/**
 * Resolve HOS profile: explicit → ISO country → GPS → continent → EU default.
 */
export function resolveHosRegion(opts: ResolveHosOpts): HosRegionId {
  if (opts.explicit && HOS_LIMITS[opts.explicit]) return opts.explicit;
  const fromCountry = hosRegionFromCountryCode(opts.countryCode);
  if (fromCountry) return fromCountry;
  if (
    typeof opts.lat === 'number' &&
    Number.isFinite(opts.lat) &&
    typeof opts.lon === 'number' &&
    Number.isFinite(opts.lon)
  ) {
    return hosRegionFromLatLon(opts.lat, opts.lon);
  }
  if (opts.continent === 'AU') return 'AU';
  if (opts.continent === 'NA') return 'US';
  if (opts.continent === 'EU' || opts.continent === 'AS') return 'EU';
  return 'EU';
}

export function getHosLimits(region: HosRegionId): HosLimits {
  return HOS_LIMITS[region];
}

export type HosCompliance = {
  region: HosRegionId;
  limits: HosLimits;
  /** continuous / daily drive used vs maxDriveSec */
  driveRatio: number;
  breakDueRatio: number;
  weeklyRatio: number;
  nearLimit: boolean;
  overLimit: boolean;
  breakOverdue: boolean;
  warnReasons: string[];
  overReasons: string[];
};

export function evaluateHosCompliance(opts: {
  region: HosRegionId;
  /** Accumulated driving seconds in current day/shift (motion-based). */
  drivingSec: number;
  /** Driving since last qualifying break. */
  sinceBreakSec: number;
  /** On-duty / work seconds in rolling week (approx). */
  weeklySec?: number;
}): HosCompliance {
  const limits = getHosLimits(opts.region);
  const drivingSec = Math.max(0, opts.drivingSec);
  const sinceBreakSec = Math.max(0, opts.sinceBreakSec);
  const weeklySec = Math.max(0, opts.weeklySec ?? drivingSec);

  const driveRatio = drivingSec / limits.maxDriveSec;
  const breakDueRatio = sinceBreakSec / limits.breakAfterDriveSec;
  const weeklyRatio = weeklySec / limits.weeklyCapSec;

  const warnReasons: string[] = [];
  const overReasons: string[] = [];

  if (driveRatio >= 1) overReasons.push(`max drive ${limits.maxDriveSec / 3600}h`);
  else if (driveRatio >= limits.warnRatio) warnReasons.push(`near max drive (${Math.round(driveRatio * 100)}%)`);

  if (breakDueRatio >= 1) overReasons.push(`break overdue after ${limits.breakAfterDriveSec / 3600}h`);
  else if (breakDueRatio >= limits.warnRatio)
    warnReasons.push(`near mandatory break (${Math.round(breakDueRatio * 100)}%)`);

  if (weeklyRatio >= 1) overReasons.push(`weekly cap ${limits.weeklyCapSec / 3600}h`);
  else if (weeklyRatio >= limits.warnRatio)
    warnReasons.push(`near weekly cap (${Math.round(weeklyRatio * 100)}%)`);

  return {
    region: opts.region,
    limits,
    driveRatio,
    breakDueRatio,
    weeklyRatio,
    nearLimit: warnReasons.length > 0 && overReasons.length === 0,
    overLimit: overReasons.length > 0,
    breakOverdue: breakDueRatio >= 1,
    warnReasons,
    overReasons,
  };
}
