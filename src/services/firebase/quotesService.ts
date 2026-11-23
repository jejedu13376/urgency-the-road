import { addDoc, collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getFirebase } from '../../firebase/config';
import type { QuoteDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { stubQuoteScan } from '../stubs';
import { liveResult, mockResult, ServiceResult } from './result';

/** Module 3 — quotes / anti-arnaque */
export async function createQuote(
  input: Omit<QuoteDoc, 'id' | 'createdAt'>,
): Promise<ServiceResult<QuoteDoc>> {
  const payload: QuoteDoc = {
    ...input,
    id: `q-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  if (!fb) return mockResult(payload, 'MOCK quote');
  const ref = await addDoc(collection(fb.db, COLLECTIONS.quotes), payload);
  return liveResult({ ...payload, id: ref.id });
}

export async function scanQuoteStub(
  ownerUid: string,
): Promise<ServiceResult<{ quote: QuoteDoc; scanLabel: string }>> {
  const scan = stubQuoteScan();
  const quote: QuoteDoc = {
    id: `q-scan-${Date.now()}`,
    ownerUid,
    lines: [
      { label: 'Pièce (OCR stub)', partPrice: 120, laborPrice: 0 },
      { label: 'Main d’œuvre (OCR stub)', partPrice: 0, laborPrice: 180 },
    ],
    currency: 'EUR',
    overchargeRisk: scan.data.overchargeRisk,
    source: 'scan_stub',
    createdAt: new Date().toISOString(),
  };
  const saved = await createQuote(quote);
  return {
    ...saved,
    data: { quote: saved.data, scanLabel: scan.label },
  };
}

export async function listQuotes(ownerUid: string): Promise<ServiceResult<QuoteDoc[]>> {
  const fb = getFirebase();
  if (!fb) return mockResult([], 'MOCK quotes list');
  const snap = await getDocs(
    query(collection(fb.db, COLLECTIONS.quotes), where('ownerUid', '==', ownerUid), limit(30)),
  );
  return liveResult(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuoteDoc, 'id'>) })));
}
