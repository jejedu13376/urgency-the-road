import { addDoc, collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getFirebase } from '../../firebase/config';
import type { InsuranceClaimDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

/** Insurance claims collection (carnet / admin flow adjacent M10/M15) */
export async function createInsuranceClaim(
  input: Omit<InsuranceClaimDoc, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ServiceResult<InsuranceClaimDoc>> {
  const now = new Date().toISOString();
  const payload: InsuranceClaimDoc = {
    ...input,
    id: `claim-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
  const fb = getFirebase();
  if (!fb) return mockResult(payload, 'MOCK insurance claim');
  const ref = await addDoc(collection(fb.db, COLLECTIONS.insuranceClaims), payload);
  return liveResult({ ...payload, id: ref.id });
}

export async function listInsuranceClaims(
  ownerUid: string,
): Promise<ServiceResult<InsuranceClaimDoc[]>> {
  const fb = getFirebase();
  if (!fb) return mockResult([], 'MOCK insurance list');
  const snap = await getDocs(
    query(
      collection(fb.db, COLLECTIONS.insuranceClaims),
      where('ownerUid', '==', ownerUid),
      limit(30),
    ),
  );
  return liveResult(
    snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InsuranceClaimDoc, 'id'>) })),
  );
}
