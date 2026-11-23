import { addDoc, collection, getDocs, limit, query, where } from 'firebase/firestore';
import { MOCK_PARTS } from '../../data/mocks';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type { QuoteDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { isDevSoftAuth, isPermissionDenied } from './devSoftAuth';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

export type QuoteScanMode = 'photo' | 'pdf';

export type QuoteScanInput = {
  ownerUid?: string;
  vin?: string;
  make?: string;
  model?: string;
  mode: QuoteScanMode;
  /** Optional selected catalogue part to anchor market comparison */
  anchorOemSku?: string;
  currency?: string;
  /**
   * Manual garage totals (anti-arnaque without OCR ML).
   * When set, compare typed amounts vs local catalogue market — no image OCR.
   */
  manualPartPrice?: number;
  manualLaborPrice?: number;
};

/** MOCK_PARTS are EUR-based — scale when fleet currency differs. */
function currencyMultiplier(currency?: string): number {
  switch ((currency ?? 'EUR').toUpperCase()) {
    case 'USD':
      return 1.2;
    case 'CAD':
      return 1.15;
    case 'AUD':
      return 1.25;
    default:
      return 1;
  }
}

function marketBench(make?: string, oemSku?: string, currency?: string) {
  const pool = MOCK_PARTS.filter((p) => {
    if (oemSku && p.oemSku === oemSku) return true;
    if (make && p.name.toLowerCase().includes(make.toLowerCase().slice(0, 4))) return true;
    return !make && !oemSku;
  });
  const parts = pool.length ? pool : MOCK_PARTS;
  const mult = currencyMultiplier(currency);
  const avgAfter =
    (parts.reduce((s, p) => s + p.priceAftermarket, 0) / Math.max(parts.length, 1)) * mult;
  const avgLabor =
    (parts.reduce((s, p) => s + p.laborHours * p.laborRate, 0) / Math.max(parts.length, 1)) * mult;
  return { avgAfter: Math.round(avgAfter), avgLabor: Math.round(avgLabor), sample: parts[0] };
}

/**
 * Heuristic « OCR » stub — builds a structured quote vs local market bench.
 * Not real OCR; prepares the same shape a future Document AI / ML Kit path would fill.
 */
export function analyzeQuoteScan(input: QuoteScanInput): {
  lines: QuoteDoc['lines'];
  overchargeRisk: NonNullable<QuoteDoc['overchargeRisk']>;
  note: string;
  marketPart: number;
  marketLabor: number;
} {
  const bench = marketBench(input.make, input.anchorOemSku, input.currency);
  const manualPartOk =
    typeof input.manualPartPrice === 'number' && Number.isFinite(input.manualPartPrice);
  const manualLaborOk =
    typeof input.manualLaborPrice === 'number' && Number.isFinite(input.manualLaborPrice);
  const hasManual = manualPartOk || manualLaborOk;

  // Manual path = real typed garage amounts (partial OK). Heuristic = market inflate (not OCR ML).
  const inflate = input.mode === 'pdf' ? 1.35 : 1.18;
  const partPrice = manualPartOk
    ? Math.round(input.manualPartPrice as number)
    : Math.round(bench.avgAfter * inflate);
  const laborPrice = manualLaborOk
    ? Math.round(input.manualLaborPrice as number)
    : Math.round(bench.avgLabor * (input.mode === 'pdf' ? 1.4 : 1.15));
  const delta = (partPrice + laborPrice) / Math.max(bench.avgAfter + bench.avgLabor, 1);
  const overchargeRisk: NonNullable<QuoteDoc['overchargeRisk']> =
    delta >= 1.45 ? 'eleve' : delta >= 1.2 ? 'moyen' : 'faible';
  const vehicleBit = [input.make, input.model, input.vin ? `VIN ${input.vin.slice(0, 8)}…` : '']
    .filter(Boolean)
    .join(' ');
  const modeLabel = hasManual
    ? manualPartOk && manualLaborOk
      ? 'saisie manuelle devis'
      : 'saisie partielle devis'
    : input.mode === 'photo'
      ? 'heuristique photo (pas OCR ML)'
      : 'heuristique PDF (pas OCR ML)';
  return {
    lines: [
      {
        label: `Pièce ${bench.sample?.name ?? 'catalogue'} (${modeLabel})`,
        partPrice,
        laborPrice: 0,
      },
      {
        label: manualLaborOk ? 'Main d’œuvre atelier (saisie)' : 'Main d’œuvre atelier (estim. marché)',
        partPrice: 0,
        laborPrice,
      },
      {
        label: `Réf. marché local ${input.currency ?? 'EUR'} (${bench.sample?.oemSku ?? '—'})`,
        partPrice: bench.avgAfter,
        laborPrice: bench.avgLabor,
      },
    ],
    overchargeRisk,
    note: `${vehicleBit || 'Véhicule'} · ${input.currency ?? 'EUR'} · écart ×${delta.toFixed(2)} vs marché adaptable. ${
      hasManual
        ? 'Comparaison saisie manuelle — OCR ML Kit / Document AI non branché.'
        : 'Aucun OCR image — heuristique catalogue uniquement (OCR ML bloqué).'
    }`,
    marketPart: bench.avgAfter,
    marketLabor: bench.avgLabor,
  };
}

/** Module 3 — quotes / anti-arnaque */
export async function createQuote(
  input: Omit<QuoteDoc, 'id' | 'createdAt'>,
): Promise<ServiceResult<QuoteDoc>> {
  const uid = getSignedInUid();
  const payload: QuoteDoc = {
    ...input,
    ownerUid: uid ?? input.ownerUid,
    id: `q-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  if (!fb || !uid) return mockResult(payload, 'MOCK quote — local (non connecté)');
  if (payload.ownerUid !== uid) {
    return failResult(payload, 'Devis refusé — ownerUid doit être le compte connecté');
  }
  try {
    const ref = await addDoc(collection(fb.db, COLLECTIONS.quotes), payload);
    return liveResult({ ...payload, id: ref.id });
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return mockResult(payload, 'SOFT quote — permission/DEV (local)');
    }
    return failResult(payload, e instanceof Error ? e.message : 'Création devis refusée');
  }
}

export async function scanQuoteStub(
  input: QuoteScanInput | string,
): Promise<ServiceResult<{ quote: QuoteDoc; scanLabel: string }>> {
  const opts: QuoteScanInput =
    typeof input === 'string' ? { ownerUid: input, mode: 'photo' } : input;
  const uid = getSignedInUid() ?? opts.ownerUid ?? 'mock-local-user';
  const analysis = analyzeQuoteScan(opts);
  const quote: QuoteDoc = {
    id: `q-scan-${Date.now()}`,
    ownerUid: uid,
    lines: analysis.lines,
    currency: opts.currency ?? 'EUR',
    overchargeRisk: analysis.overchargeRisk,
    source: 'scan_stub',
    createdAt: new Date().toISOString(),
  };
  const saved = await createQuote(quote);
  return {
    ...saved,
    data: {
      quote: saved.data,
      scanLabel: analysis.note,
    },
  };
}

export async function listQuotes(ownerUid: string): Promise<ServiceResult<QuoteDoc[]>> {
  const fb = getFirebase();
  const uid = getSignedInUid() ?? ownerUid;
  if (!fb || !getSignedInUid()) return mockResult([], 'MOCK quotes list');
  try {
    const snap = await getDocs(
      query(collection(fb.db, COLLECTIONS.quotes), where('ownerUid', '==', uid), limit(30)),
    );
    return liveResult(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuoteDoc, 'id'>) })));
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return mockResult([], 'SOFT quotes list — permission/DEV (vide mock)');
    }
    return failResult([], e instanceof Error ? e.message : 'Lecture devis refusée');
  }
}
