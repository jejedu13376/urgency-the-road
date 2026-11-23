import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type { RoadHazardDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { isDevSoftAuth, isPermissionDenied } from './devSoftAuth';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

const MOCK_HAZARDS: RoadHazardDoc[] = [
  {
    id: 'hz1',
    reporterUid: 'mock',
    kind: 'travaux',
    lat: 50.63,
    lon: 3.06,
    note: 'Voie de droite fermée',
    createdAt: new Date().toISOString(),
  },
];

/** Module 7 — signalements routiers */
export async function listRoadHazards(): Promise<ServiceResult<RoadHazardDoc[]>> {
  const fb = getFirebase();
  if (!fb) return mockResult(MOCK_HAZARDS, 'MOCK road hazards');

  try {
    const snap = await getDocs(
      query(collection(fb.db, COLLECTIONS.roadHazards), orderBy('createdAt', 'desc'), limit(40)),
    );
    if (snap.empty) return mockResult(MOCK_HAZARDS, 'MOCK hazards — Firestore vide');
    return liveResult(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoadHazardDoc, 'id'>) })),
    );
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return mockResult(MOCK_HAZARDS, 'SOFT hazards — permission/DEV (mock pins)');
    }
    // Empty + ok:false — never ship MOCK pins as a firebase-looking failure (GPS checks ok).
    return failResult([], e instanceof Error ? e.message : 'Lecture signalements refusée');
  }
}

export async function reportHazard(
  input: Omit<RoadHazardDoc, 'id' | 'createdAt'>,
): Promise<ServiceResult<RoadHazardDoc>> {
  const uid = getSignedInUid();
  const payload: RoadHazardDoc = {
    ...input,
    reporterUid: uid ?? input.reporterUid,
    id: `hz-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  if (!fb || !uid) {
    return mockResult(payload, 'MOCK hazard report — Auth requise pour sync Firestore');
  }

  const owned = { ...payload, reporterUid: uid };
  try {
    const ref = await addDoc(collection(fb.db, COLLECTIONS.roadHazards), owned);
    return liveResult({ ...owned, id: ref.id });
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return mockResult(owned, 'SOFT hazard report — permission/DEV (local)');
    }
    return failResult(owned, e instanceof Error ? e.message : 'Signalement refusé');
  }
}
