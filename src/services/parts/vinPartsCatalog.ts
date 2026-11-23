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

function pricingForMakeHint(make?: string, countryHint?: string): RegionPricing {
  const m = (make ?? '').toLowerCase();
  const c = (countryHint ?? '').toUpperCase();
  if (c === 'CA' || m.includes('ford') || m.includes('gm') || m.includes('ram')) {
    return { currency: 'CAD', region: 'NA-CA', laborRate: 120, multiplier: 1.15 };
  }
  if (c === 'US') {
    return { currency: 'USD', region: 'NA-US', laborRate: 135, multiplier: 1.2 };
  }
  if (c === 'AU') {
    return { currency: 'AUD', region: 'AU', laborRate: 140, multiplier: 1.25 };
  }
  if (m.includes('mercedes') || m.includes('actros') || m.includes('iveco')) {
    return { currency: 'EUR', region: 'EU-DE', laborRate: 110, multiplier: 1.1 };
  }
  return { currency: 'EUR', region: 'EU-FR', laborRate: 85, multiplier: 1 };
}

const EXTRA_TEMPLATES: Array<Omit<PartDoc, 'id' | 'currency' | 'region' | 'laborRate' | 'updatedAt' | 'buyUrlStub' | 'vinPrefix' | 'vehicleMake'>> = [
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

function buyUrl(name: string, oemSku: string, make?: string): string {
  const q = [make, oemSku, name, 'pièce auto'].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function scalePrice(n: number, mult: number): number {
  return Math.round(n * mult);
}

/**
 * Build a VIN-compatible shopping list from local templates + WMI make hint.
 * Labels must stay honest: not a live OEM mondial catalogue.
 */
export function buildVinPartsCatalog(vin?: string, opts?: { isHeavyTruck?: boolean }): PartDoc[] {
  const clean = vin ? normalizeVin(vin) : '';
  const hint = clean.length >= 3 ? hintFromWmi(clean) : null;
  const pricing = pricingForMakeHint(hint?.make, hint?.country);
  const makeKey = hint?.make?.split(/[\s/]/)[0] ?? undefined;

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

  // Deduplicate by oemSku
  const bySku = new Map<string, (typeof base)[0]>();
  for (const row of base) {
    if (!bySku.has(row.oemSku)) bySku.set(row.oemSku, row);
  }

  let rows: PartDoc[] = [...bySku.values()].map((p, i) => ({
    id: `vp-${i + 1}-${p.oemSku}`,
    name: makeKey && makeKey !== 'Générique' ? `${p.name} (${makeKey})` : p.name,
    category: p.category,
    oemSku: p.oemSku,
    priceNew: scalePrice(p.priceNew, pricing.multiplier),
    priceOem: scalePrice(p.priceOem, pricing.multiplier),
    priceAftermarket: scalePrice(p.priceAftermarket, pricing.multiplier),
    laborHours: p.laborHours,
    laborRate: pricing.laborRate,
    currency: pricing.currency,
    region: pricing.region,
    buyUrlStub: buyUrl(p.name, p.oemSku, makeKey),
    vinPrefix: clean.length >= 8 ? clean.slice(0, 8) : undefined,
    vehicleMake: hint?.make,
    updatedAt: new Date().toISOString(),
  }));

  // Prefer fluids/filters always; keep mechanical if make matches or generic
  if (makeKey && makeKey.toLowerCase() !== 'générique' && makeKey.toLowerCase() !== 'oem') {
    const mk = makeKey.toLowerCase().slice(0, 4);
    const filtered = rows.filter(
      (p) =>
        p.category === 'filtre' ||
        p.category === 'fluide' ||
        p.name.toLowerCase().includes(mk) ||
        p.vehicleMake?.toLowerCase().includes(mk) ||
        p.category === 'mecanique' ||
        p.category === 'electrique' ||
        p.category === 'carrosserie',
    );
    if (filtered.length) rows = filtered;
  }

  return rows;
}

export function catalogLabel(vin?: string, source: 'firebase' | 'local' = 'local'): string {
  const clean = vin ? normalizeVin(vin) : '';
  if (source === 'firebase') return 'Catalogue Firestore LIVE';
  if (!clean) return 'Catalogue local générique — activez un VIN (M1/M2)';
  const hint = hintFromWmi(clean);
  return `Liste d’achats locale VIN ${clean.slice(0, 8)}… · WMI ${hint?.make ?? 'générique'} (pas d’API OEM mondiale)`;
}
