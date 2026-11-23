import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebase } from '../../firebase/config';
import type { GpsPrefsDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

/** Module 7 — GPS prefs */
export async function getGpsPrefs(ownerUid: string): Promise<ServiceResult<GpsPrefsDoc>> {
  const fallback: GpsPrefsDoc = {
    id: ownerUid,
    ownerUid,
    mode: 'voiture',
    truckHeightM: 4.0,
    truckWidthM: 2.55,
    truckPtacT: 40,
    hazmat: false,
    preferApps: ['google', 'waze', 'apple'],
    updatedAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  if (!fb) return mockResult(fallback, 'MOCK GPS prefs');

  const snap = await getDoc(doc(fb.db, COLLECTIONS.gpsPrefs, ownerUid));
  if (!snap.exists()) return liveResult(fallback);
  return liveResult({ id: snap.id, ...(snap.data() as Omit<GpsPrefsDoc, 'id'>) });
}

export async function saveGpsPrefs(prefs: GpsPrefsDoc): Promise<ServiceResult<GpsPrefsDoc>> {
  const payload = { ...prefs, updatedAt: new Date().toISOString() };
  const fb = getFirebase();
  if (!fb) return mockResult(payload, 'MOCK GPS prefs save');
  await setDoc(doc(fb.db, COLLECTIONS.gpsPrefs, prefs.ownerUid), payload, { merge: true });
  return liveResult(payload);
}
