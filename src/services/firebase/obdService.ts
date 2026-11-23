import { addDoc, collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { MOCK_DTC } from '../../data/mocks';
import { getFirebase } from '../../firebase/config';
import type { ObdProtocol, ObdReadingDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { stubObdConnect } from '../stubs';
import { liveResult, mockResult, ServiceResult } from './result';

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
  if (!fb) {
    return mockResult(reading, 'MOCK OBD — pas de valise physique / BT');
  }
  const ref = await addDoc(collection(fb.db, COLLECTIONS.obdReadings), reading);
  return liveResult({ ...reading, id: ref.id, source: 'stub' });
}

export async function listObdHistory(
  vehicleId: string,
): Promise<ServiceResult<ObdReadingDoc[]>> {
  const fb = getFirebase();
  if (!fb) {
    return mockResult(
      [mockReading('mock', vehicleId, 'J1939')],
      'MOCK OBD history',
    );
  }
  const q = query(
    collection(fb.db, COLLECTIONS.obdReadings),
    where('vehicleId', '==', vehicleId),
    orderBy('recordedAt', 'desc'),
    limit(20),
  );
  const snap = await getDocs(q);
  return liveResult(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ObdReadingDoc, 'id'>) })));
}
