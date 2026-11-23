/**
 * Module 3 — VIN-aware purchase list generator (local catalogue + WMI filter).
 * Not a mondial OEM API — honest labeled local generation with real search buy URLs.
 */
import { MOCK_PARTS } from '../../data/mocks';
import type { PartDoc } from '../../types/firestore';
import { hintFromWmi, normalizeVin } from '../vin/vinNormalize';

type RegionPricing = {
  currency: string;
  region: string;
  laborRate: number;
  multiplier: number;
};

export type BuildCatalogOpts = {
  isHeavyTruck?: boolean;
  /** Prefer fleet make/model/year over WMI-only when available (M1 active vehicle). */
  make?: string;
  model?: string;
  year?: number;
  currency?: string;
};

function pricingForMakeHint(make?: string, countryHint?: string, currencyOverride?: string): RegionPricing {
  if (currencyOverride === 'USD') {
    return { currency: 'USD', region: 'NA-US', laborRate: 135, multiplier: 1.2 };
  }
  if (currencyOverride === 'CAD') {
    return { currency: 'CAD', region: 'NA-CA', laborRate: 120, multiplier: 1.15 };
  }
  if (currencyOverride === 'AUD') {
    return { currency: 'AUD', region: 'AU', laborRate: 140, multiplier: 1.25 };
  }
  if (currencyOverride === 'EUR') {
    return { currency: 'EUR', region: 'EU-FR', laborRate: 85, multiplier: 1 };
  }

  const m = (make ?? '').toLowerCase();
  const c = (countryHint ?? '').toUpperCase();
  // WMI country wins before make heuristics (US/AU Ford ≠ CAD)
  if (c === 'US') {
    return { currency: 'USD', region: 'NA-US', laborRate: 135, multiplier: 1.2 };
  }
  if (c === 'AU') {
    return { currency: 'AUD', region: 'AU', laborRate: 140, multiplier: 1.25 };
  }
  if (c === 'CA') {
    return { currency: 'CAD', region: 'NA-CA', laborRate: 120, multiplier: 1.15 };
  }
  if (m.includes('ford') || m.includes('gm') || m.includes('ram')) {
    return { currency: 'CAD', region: 'NA-CA', laborRate: 120, multiplier: 1.15 };
  }
  if (m.includes('mercedes') || m.includes('actros') || m.includes('iveco')) {
    return { currency: 'EUR', region: 'EU-DE', laborRate: 110, multiplier: 1.1 };
  }
  return { currency: 'EUR', region: 'EU-FR', laborRate: 85, multiplier: 1 };
}

const EXTRA_TEMPLATES: Array<
  Omit<PartDoc, 'id' | 'currency' | 'region' | 'laborRate' | 'updatedAt' | 'buyUrlStub' | 'buyUrls' | 'vinPrefix' | 'vehicleMake' | 'vehicleModel'>
> = [
  {
    name: 'Filtre à air',
    category: 'filtre',
    oemSku: 'OE-AIR-01',
    priceNew: 32,
    priceOem: 45,
    priceAftermarket: 22,
    laborHours: 0.3,
  },
  {
    name: 'Filtre habitacle',
    category: 'filtre',
    oemSku: 'OE-CABIN-01',
    priceNew: 28,
    priceOem: 38,
    priceAftermarket: 18,
    laborHours: 0.4,
  },
  {
    name: 'Huile moteur 5W30 (5 L)',
    category: 'fluide',
    oemSku: 'FL-5W30-5L',
    priceNew: 55,
    priceOem: 72,
    priceAftermarket: 42,
    laborHours: 0.5,
  },
  {
    name: 'Liquide de frein DOT4',
    category: 'fluide',
    oemSku: 'FL-DOT4',
    priceNew: 16,
    priceOem: 22,
    priceAftermarket: 11,
    laborHours: 0.6,
  },
  {
    name: 'Disques avant (paire)',
    category: 'mecanique',
    oemSku: 'OE-BRK-D',
    priceNew: 145,
    priceOem: 210,
    priceAftermarket: 98,
    laborHours: 1.8,
  },
  {
    name: 'Batterie 12V',
    category: 'electrique',
    oemSku: 'OE-BAT-12',
    priceNew: 160,
    priceOem: 220,
    priceAftermarket: 120,
    laborHours: 0.5,
  },
  {
    name: 'Essuie-glaces (paire)',
    category: 'carrosserie',
    oemSku: 'OE-WIPER',
    priceNew: 35,
    priceOem: 48,
    priceAftermarket: 22,
    laborHours: 0.2,
  },
  {
    name: 'Ampoule H7',
    category: 'electrique',
    oemSku: 'OE-H7',
    priceNew: 18,
    priceOem: 28,
    priceAftermarket: 9,
    laborHours: 0.3,
  },
  {
    name: 'Courroie accessoire',
    category: 'mecanique',
    oemSku: 'OE-BELT-A',
    priceNew: 48,
    priceOem: 72,
    priceAftermarket: 32,
    laborHours: 0.9,
  },
  {
    name: 'Thermostat',
    category: 'mecanique',
    oemSku: 'OE-THERM',
    priceNew: 55,
    priceOem: 85,
    priceAftermarket: 38,
    laborHours: 1.4,
  },
];

const PL_EXTRAS: typeof EXTRA_TEMPLATES = [
  {
    name: 'Capteur NOx amont',
    category: 'electrique',
    oemSku: 'A0009053109',
    priceNew: 420,
    priceOem: 580,
    priceAftermarket: 310,
    laborHours: 1.8,
  },
  {
    name: 'Filtre AdBlue',
    category: 'filtre',
    oemSku: 'PL-ADBLUE-F',
    priceNew: 85,
    priceOem: 120,
    priceAftermarket: 65,
    laborHours: 0.8,
  },
  {
    name: 'Huile moteur PL 15W40 (20 L)',
    category: 'fluide',
    oemSku: 'PL-15W40-20',
    priceNew: 140,
    priceOem: 190,
    priceAftermarket: 110,
    laborHours: 1.2,
  },
];

function buildBuyUrls(name: string, oemSku: string, make?: string, model?: string, year?: number): Array<{ label: string; url: string }> {
  const qCore = [make, model, year ? String(year) : '', oemSku, name].filter(Boolean).join(' ');
  const qShort = [make, oemSku, name, 'pièce auto'].filter(Boolean).join(' ');
  return [
    {
      label: 'Recherche web',
      url: `https://www.google.com/search?q=${encodeURIComponent(qCore || qShort)}`,
    },
    {
      label: 'Amazon',
      url: `https://www.amazon.fr/s?k=${encodeURIComponent([make, oemSku, name].filter(Boolean).join(' '))}`,
    },
    {
      label: 'RockAuto (NA)',
      url: `https://www.rockauto.com/en/catalog/?search=${encodeURIComponent([make, model, oemSku].filter(Boolean).join(' '))}`,
    },
  ];
}

function scalePrice(n: number, mult: number): number {
  return Math.round(n * mult);
}

/** True when SKU is a universal OE/FL template (safe for any make). */
function isGenericSku(oemSku: string): boolean {
  const s = oemSku.toUpperCase();
  return s.startsWith('OE-') || s.startsWith('FL-');
}

/** Mercedes-style OEM (A000…) — only keep for Mercedes/Benz WMI. */
function isMercedesSku(oemSku: string): boolean {
  return /^A\d{3}/i.test(oemSku);
}

function isHeavyTruckSku(oemSku: string): boolean {
  return oemSku.toUpperCase().startsWith('PL-');
}

function makeAllowsSku(oemSku: string, makeKey?: string, isHeavyTruck?: boolean): boolean {
  if (isHeavyTruckSku(oemSku)) return Boolean(isHeavyTruck);
  if (isGenericSku(oemSku)) return true;
  if (isMercedesSku(oemSku)) {
    const mk = (makeKey ?? '').toLowerCase();
    return mk.includes('mercedes') || mk.includes('benz');
  }
  // Unknown OEM style: keep only without a specific make, else drop foreign SKUs
  if (!makeKey || makeKey.toLowerCase() === 'générique' || makeKey.toLowerCase() === 'oem') {
    return true;
  }
  return false;
}

/**
 * Build a VIN-compatible shopping list from local templates + WMI / fleet make hint.
 * Labels must stay honest: not a live OEM mondial catalogue.
 */
export function buildVinPartsCatalog(vin?: string, opts?: BuildCatalogOpts): PartDoc[] {
  const clean = vin ? normalizeVin(vin) : '';
  const hint = clean.length >= 3 ? hintFromWmi(clean) : null;
  const makeFromFleet = opts?.make?.trim();
  const makeKey =
    makeFromFleet?.split(/[\s/]/)[0] ?? hint?.make?.split(/[\s/]/)[0] ?? undefined;
  const pricing = pricingForMakeHint(makeKey ?? hint?.make, hint?.country, opts?.currency);
  const model = opts?.model?.trim();
  const year = opts?.year;

  const base = [
    ...MOCK_PARTS.map((p) => ({
      name: p.name,
      category: p.category,
      oemSku: p.oemSku,
      priceNew: p.priceNew,
      priceOem: p.priceOem,
      priceAftermarket: p.priceAftermarket,
      laborHours: p.laborHours,
    })),
    ...EXTRA_TEMPLATES,
    ...(opts?.isHeavyTruck ? PL_EXTRAS : []),
  ];

  // Deduplicate by oemSku, then filter by WMI/make BEFORE relabeling
  const bySku = new Map<string, (typeof base)[0]>();
  for (const row of base) {
    if (!bySku.has(row.oemSku)) bySku.set(row.oemSku, row);
  }

  const filteredTemplates = [...bySku.values()].filter((p) => {
    if (p.category === 'filtre' || p.category === 'fluide') {
      if (isMercedesSku(p.oemSku) || isHeavyTruckSku(p.oemSku)) {
        return makeAllowsSku(p.oemSku, makeKey, opts?.isHeavyTruck);
      }
      return true;
    }
    return makeAllowsSku(p.oemSku, makeKey, opts?.isHeavyTruck);
  });

  return filteredTemplates.map((p, i) => {
    const buyUrls = buildBuyUrls(p.name, p.oemSku, makeKey, model, year);
    const displayMake = makeKey && makeKey !== 'Générique' ? makeKey : undefined;
    return {
      id: `vp-${i + 1}-${p.oemSku}`,
      name: displayMake ? `${p.name} (${displayMake})` : p.name,
      category: p.category,
      oemSku: p.oemSku,
      priceNew: scalePrice(p.priceNew, pricing.multiplier),
      priceOem: scalePrice(p.priceOem, pricing.multiplier),
      priceAftermarket: scalePrice(p.priceAftermarket, pricing.multiplier),
      laborHours: p.laborHours,
      laborRate: pricing.laborRate,
      currency: pricing.currency,
      region: pricing.region,
      buyUrlStub: buyUrls[0]?.url,
      buyUrls,
      vinPrefix: clean.length >= 8 ? clean.slice(0, 8) : undefined,
      vehicleMake: makeFromFleet || hint?.make,
      vehicleModel: model,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function catalogLabel(vin?: string, source: 'firebase' | 'local' = 'local'): string {
  const clean = vin ? normalizeVin(vin) : '';
  if (source === 'firebase') return 'Catalogue Firestore LIVE';
  if (!clean) return 'Catalogue local générique — activez un VIN (M1/M2) · pas d’API OEM mondiale';
  const hint = hintFromWmi(clean);
  return `Liste d’achats locale VIN ${clean.slice(0, 8)}… · WMI ${hint?.make ?? 'générique'} (pas d’API OEM mondiale)`;
}

/** OCR ML Kit / Document AI — blocked; documented for MODULES-STATUS. */
export const OEM_CATALOGUE_BLOCKED =
  'Catalogue OEM mondial non branché — liste locale WMI/VIN + recherches web uniquement.';

export const OCR_ML_BLOCKED =
  'OCR ML Kit / Document AI non branché — saisie manuelle des montants devis ou heuristique marché.';
