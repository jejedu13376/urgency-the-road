import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type { GpsPrefsDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { isDevSoftAuth, isPermissionDenied } from './devSoftAuth';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

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
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return failResult(
        fallback,
        isPermissionDenied(e)
          ? 'SOFT GPS prefs — permission refusée (défauts locaux, ok:false)'
          : 'SOFT GPS prefs — DEV (défauts locaux, ok:false)',
      );
    }
    return failResult(
      fallback,
      e instanceof Error ? `GPS prefs lecture refusée — ${e.message}` : 'GPS prefs lecture refusée',
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
  try {
    await setDoc(doc(fb.db, COLLECTIONS.gpsPrefs, uid), owned, { merge: true });
    return liveResult(owned);
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return failResult(owned, 'SOFT GPS prefs save — permission/DEV (local, ok:false)');
    }
    return failResult(owned, e instanceof Error ? e.message : 'GPS prefs save refusé');
  }
}
