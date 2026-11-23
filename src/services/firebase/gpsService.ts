import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type { GpsPrefsDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

function fallbackPrefs(ownerUid: string): GpsPrefsDoc {
  return {
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
}

/** Module 7 — GPS prefs (mock when Firebase unsigned / unconfigured). */
export async function getGpsPrefs(ownerUid: string): Promise<ServiceResult<GpsPrefsDoc>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  const key = uid ?? ownerUid;
  const fallback = fallbackPrefs(key);

  if (!fb || !uid) {
    return mockResult(fallback, 'MOCK GPS prefs (non connecté ou Firebase off)');
  }

  try {
    const snap = await getDoc(doc(fb.db, COLLECTIONS.gpsPrefs, uid));
    if (!snap.exists()) return liveResult(fallback);
    return liveResult({ id: snap.id, ...(snap.data() as Omit<GpsPrefsDoc, 'id'>) });
  } catch (e) {
    return mockResult(
      fallback,
      e instanceof Error ? `GPS prefs mock — ${e.message}` : 'GPS prefs mock',
    );
  }
}

export async function saveGpsPrefs(prefs: GpsPrefsDoc): Promise<ServiceResult<GpsPrefsDoc>> {
  const payload = { ...prefs, updatedAt: new Date().toISOString() };
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) {
    return mockResult(payload, 'MOCK GPS prefs save (non connecté)');
  }
  const owned = { ...payload, ownerUid: uid, id: uid };
  await setDoc(doc(fb.db, COLLECTIONS.gpsPrefs, uid), owned, { merge: true });
  return liveResult(owned);
}
