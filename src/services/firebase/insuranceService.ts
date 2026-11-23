import { addDoc, collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type { InsuranceClaimDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { isDevSoftAuth, isPermissionDenied } from './devSoftAuth';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

/** Insurance claims collection (carnet / admin flow adjacent M10/M15) */
export async function createInsuranceClaim(
  input: Omit<InsuranceClaimDoc, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ServiceResult<InsuranceClaimDoc>> {
  const uid = getSignedInUid();
  const now = new Date().toISOString();
  const payload: InsuranceClaimDoc = {
    ...input,
    ownerUid: uid ?? input.ownerUid,
    id: `claim-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
  const fb = getFirebase();
  if (!fb || !uid) return mockResult(payload, 'MOCK insurance claim — Auth requise');
  const owned = { ...payload, ownerUid: uid };
  try {
    const ref = await addDoc(collection(fb.db, COLLECTIONS.insuranceClaims), owned);
    return liveResult({ ...owned, id: ref.id });
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return failResult(owned, 'SOFT insurance — permission/DEV (local, ok:false)');
    }
    return failResult(owned, e instanceof Error ? e.message : 'Sinistre refusé');
  }
}

export async function listInsuranceClaims(
  ownerUid: string,
): Promise<ServiceResult<InsuranceClaimDoc[]>> {
  const fb = getFirebase();
  const uid = getSignedInUid() ?? ownerUid;
  if (!fb || !getSignedInUid()) return mockResult([], 'MOCK insurance list');
  try {
    const snap = await getDocs(
      query(
        collection(fb.db, COLLECTIONS.insuranceClaims),
        where('ownerUid', '==', uid),
        limit(30),
      ),
    );
    return liveResult(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InsuranceClaimDoc, 'id'>) })),
    );
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return failResult([], 'SOFT insurance list — permission/DEV (vide, ok:false)');
    }
    return failResult([], e instanceof Error ? e.message : 'Lecture sinistres refusée');
  }
}
