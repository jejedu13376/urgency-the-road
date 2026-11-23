import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { getFirebase } from '../../firebase/config';
import type { RoadHazardDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

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

  const snap = await getDocs(
    query(collection(fb.db, COLLECTIONS.roadHazards), orderBy('createdAt', 'desc'), limit(40)),
  );
  if (snap.empty) return mockResult(MOCK_HAZARDS, 'MOCK hazards — Firestore vide');
  return liveResult(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoadHazardDoc, 'id'>) })));
}

export async function reportHazard(
  input: Omit<RoadHazardDoc, 'id' | 'createdAt'>,
): Promise<ServiceResult<RoadHazardDoc>> {
  const payload: RoadHazardDoc = {
    ...input,
    id: `hz-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  if (!fb) return mockResult(payload, 'MOCK hazard report');
  const ref = await addDoc(collection(fb.db, COLLECTIONS.roadHazards), payload);
  return liveResult({ ...payload, id: ref.id });
}
