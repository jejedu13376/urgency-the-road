/**
 * Module 4 — camera-text diagnostic path (free).
 * Uses a captured photo URI + user text description → Multi-IA / local parts pricing.
 * Does NOT analyze image pixels (vision blocked) and does NOT capture mic audio.
 */
import { buildVinPartsCatalog } from '../parts/vinPartsCatalog';
import type { PartDoc } from '../../types/firestore';

export type CameraTextQuote = {
  partName: string;
  partPrice: number;
  laborPrice: number;
  currency: string;
  oemSku?: string;
  buyUrl?: string;
  matchedFromCatalog: boolean;
};

const KEYWORD_PART: Array<{ re: RegExp; nameHints: string[] }> = [
  { re: /frein|plaquette|étrier|disque|brake/i, nameHints: ['Plaquettes', 'Disques'] },
  { re: /batterie|alternateur|démarrage/i, nameHints: ['Batterie', 'Alternateur'] },
  { re: /filtre.*(huile|air|habitacle)|huile moteur/i, nameHints: ['Filtre', 'Huile'] },
  { re: /nox|adblue|scr/i, nameHints: ['NOx', 'AdBlue'] },
  { re: /courroie|galet|accessoire/i, nameHints: ['Courroie', 'BELT'] },
  { re: /fuite|joint|huileuse/i, nameHints: ['Joint', 'Huile'] },
  { re: /pneu|pneumatique|jante|tire|tyre/i, nameHints: ['pneu', 'pneumatique'] },
  { re: /essuie.?glace|wiper/i, nameHints: ['Essuie'] },
  { re: /ampoule|phare|éclairage/i, nameHints: ['Ampoule', 'H7'] },
];

function scorePart(part: PartDoc, desc: string, hints: string[]): number {
  const hay = `${part.name} ${part.oemSku} ${part.category}`.toLowerCase();
  let score = 0;
  for (const h of hints) {
    if (hay.includes(h.toLowerCase())) score += 3;
  }
  const tokens = desc
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôùûüç0-9]+/i)
    .filter((t) => t.length > 3);
  for (const t of tokens) {
    if (hay.includes(t)) score += 1;
  }
  return score;
}

/**
 * Map a free-text (camera description) to a catalogue part + devis approx.
 * Real local matching — no vision model, no invented OEM SKU API.
 */
export function quoteFromCameraText(opts: {
  description: string;
  vin?: string;
  isHeavyTruck?: boolean;
  make?: string;
  model?: string;
  year?: number;
  currency?: string;
  likelyParts?: string[];
}): CameraTextQuote {
  const catalog = buildVinPartsCatalog(opts.vin, {
    isHeavyTruck: opts.isHeavyTruck,
    make: opts.make,
    model: opts.model,
    year: opts.year,
    currency: opts.currency,
  });

  const hints: string[] = [...(opts.likelyParts ?? [])];
  for (const row of KEYWORD_PART) {
    if (row.re.test(opts.description)) hints.push(...row.nameHints);
  }

  let best: PartDoc | null = null;
  let bestScore = 0;
  for (const p of catalog) {
    const s = scorePart(p, opts.description, hints);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }

  if (best && bestScore > 0) {
    return {
      partName: best.name,
      partPrice: best.priceAftermarket,
      laborPrice: Math.round(best.laborHours * best.laborRate),
      currency: best.currency,
      oemSku: best.oemSku,
      buyUrl: best.buyUrlStub,
      matchedFromCatalog: true,
    };
  }

  const currency = opts.currency ?? catalog[0]?.currency ?? 'EUR';
  const fallbackName = opts.likelyParts?.[0] ?? (opts.isHeavyTruck ? 'Capteur / pièce PL à confirmer' : 'Pièce à confirmer');
  return {
    partName: fallbackName,
    partPrice: opts.isHeavyTruck ? 310 : 55,
    laborPrice: opts.isHeavyTruck ? 198 : 102,
    currency,
    matchedFromCatalog: false,
  };
}

export const VISION_PIXELS_BLOCKED =
  'Vision pixels non branchée — capture caméra + description texte uniquement (pas d’identification visuelle IA / API vision).';

/** @deprecated Prefer MIC_AUDIO_LIVE from acousticMic — kept for UI banners during migration. */
export const MIC_AUDIO_BLOCKED =
  'Micro LIVE possible (expo-audio) — heuristique metering ; pas de classification ML spectrale.';
