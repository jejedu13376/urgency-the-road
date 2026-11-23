import { addDoc, collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { MOCK_DTC } from '../../data/mocks';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type { ObdProtocol, ObdReadingDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { stubObdConnect } from '../stubs';
import { isDevSoftAuth, isPermissionDenied } from './devSoftAuth';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

function mockReading(ownerUid: string, vehicleId: string, protocol: ObdProtocol): ObdReadingDoc {
  const stub = stubObdConnect();
  return {
    id: `mock-obd-${Date.now()}`,
    ownerUid,
    vehicleId,
    protocol,
    dtcCodes: MOCK_DTC.map((d) => ({
      code: d.code,
      plainLanguage: d.plainLanguage,
      severity: d.severity,
    })),
    sensors: { rpm: 812, ectC: 89, batV: 13.9, mapKpa: 31 },
    connected: stub.data.connected,
    source: 'mock',
    recordedAt: new Date().toISOString(),
  };
}

/** Module 5 — OBD2 + SAE J1939 (physical adapter not present → mock). */
export async function readObdSnapshot(
  ownerUid: string,
  vehicleId: string,
  protocol: ObdProtocol = 'OBD2',
): Promise<ServiceResult<ObdReadingDoc>> {
  const reading = mockReading(ownerUid, vehicleId, protocol);
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) {
    return mockResult(reading, 'MOCK OBD — pas de valise physique / BT (ou non connecté)');
  }
  const payload = { ...reading, ownerUid: uid };
  try {
    const ref = await addDoc(collection(fb.db, COLLECTIONS.obdReadings), payload);
    return liveResult({ ...payload, id: ref.id, source: 'stub' });
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      // Never present mock DTCs as a successful signed-in read.
      return failResult(
        {
          ...payload,
          dtcCodes: [],
          sensors: {},
          connected: false,
          source: 'mock',
        },
        'SOFT OBD — permission/DEV (pas de lecture mock présentée comme live)',
      );
    }
    return failResult(
      { ...payload, dtcCodes: [], sensors: {}, connected: false },
      e instanceof Error ? e.message : 'OBD write refusé',
    );
  }
}

export async function listObdHistory(
  vehicleId: string,
  ownerUid?: string,
): Promise<ServiceResult<ObdReadingDoc[]>> {
  const fb = getFirebase();
  const uid = getSignedInUid() ?? ownerUid;
  if (!fb || !uid || uid === 'mock-local-user') {
    return mockResult(
      [mockReading(uid ?? 'mock', vehicleId, 'J1939')],
      'MOCK OBD history',
    );
  }
  // Rules require ownerUid match — query must constrain to allowed docs.
  try {
    const q = query(
      collection(fb.db, COLLECTIONS.obdReadings),
      where('ownerUid', '==', uid),
      where('vehicleId', '==', vehicleId),
      orderBy('recordedAt', 'desc'),
      limit(20),
    );
    const snap = await getDocs(q);
    return liveResult(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ObdReadingDoc, 'id'>) })),
    );
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return failResult([], 'SOFT OBD history — permission/DEV (vide, ok:false)');
    }
    return failResult([], e instanceof Error ? e.message : 'OBD history refusée');
  }
}
