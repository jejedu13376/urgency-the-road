import { collection, getDocs, limit, query } from 'firebase/firestore';
import { MOCK_PLACES } from '../../data/mocks';
import { getFirebase } from '../../firebase/config';
import type { WeighStationDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

function mockStations(): WeighStationDoc[] {
  return MOCK_PLACES.filter((p) => p.kind === 'pesage').map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    lat: p.lat,
    lon: p.lon,
    region: 'EU',
    status: 'open',
    litUp: true,
    heightLimitM: 4.2,
    weightLimitT: 44,
    updatedAt: new Date().toISOString(),
  }));
}

/** Module 8 — weigh stations (litUp / open clearly signaled) */
export async function listWeighStations(): Promise<ServiceResult<WeighStationDoc[]>> {
  const fb = getFirebase();
  if (!fb) return mockResult(mockStations(), 'MOCK weigh stations');

  const snap = await getDocs(query(collection(fb.db, COLLECTIONS.weighStations), limit(50)));
  if (snap.empty) return mockResult(mockStations(), 'MOCK weigh — Firestore vide');
  return liveResult(
    snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WeighStationDoc, 'id'>) })),
  );
}
