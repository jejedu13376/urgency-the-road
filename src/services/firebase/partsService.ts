import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { MOCK_PARTS } from '../../data/mocks';
import { getFirebase } from '../../firebase/config';
import type { PartDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

/** Module 3 */
export async function listPartsForVin(vin?: string): Promise<ServiceResult<PartDoc[]>> {
  const fb = getFirebase();
  if (!fb) {
    const data = MOCK_PARTS.map((p) => ({
      ...p,
      updatedAt: new Date().toISOString(),
      buyUrlStub: `https://example.parts/search?q=${encodeURIComponent(p.oemSku)}`,
    }));
    return mockResult(data, 'MOCK parts — catalogue local');
  }

  const col = collection(fb.db, COLLECTIONS.parts);
  const q = vin
    ? query(col, where('vinPrefix', '==', vin.slice(0, 8)), limit(50))
    : query(col, limit(50));
  const snap = await getDocs(q);
  if (snap.empty) {
    return mockResult(
      MOCK_PARTS.map((p) => ({ ...p, updatedAt: new Date().toISOString() })),
      'MOCK parts — collection Firestore vide, fallback local',
    );
  }
  return liveResult(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PartDoc, 'id'>) })));
}
