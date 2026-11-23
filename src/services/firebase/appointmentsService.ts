import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type { AppointmentDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

let mockStore: AppointmentDoc[] = [
  {
    id: 'a1',
    garageOwnerUid: 'garage-pro-1',
    clientName: 'Martin D.',
    vehicleLabel: 'Clio V',
    status: 'confirmed',
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    estimatedTotal: 340,
    currency: 'EUR',
    notes: 'Vidange + freins',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'a2',
    garageOwnerUid: 'garage-pro-1',
    clientName: 'Sophie L.',
    vehicleLabel: 'F-150',
    status: 'requested',
    scheduledAt: new Date(Date.now() + 172800000).toISOString(),
    estimatedTotal: 520,
    currency: 'CAD',
    createdAt: new Date().toISOString(),
  },
];

/** Module 17 — Pro garagistes appointments */
export async function listAppointmentsForGarage(
  garageOwnerUid: string,
): Promise<ServiceResult<AppointmentDoc[]>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) {
    return mockResult(
      mockStore.filter((a) => a.garageOwnerUid === garageOwnerUid || garageOwnerUid === 'garage-pro-1'),
      'MOCK appointments Pro',
    );
  }

  const snap = await getDocs(
    query(
      collection(fb.db, COLLECTIONS.appointments),
      where('garageOwnerUid', '==', garageOwnerUid),
      orderBy('scheduledAt', 'asc'),
      limit(40),
    ),
  );
  if (snap.empty) return mockResult(mockStore, 'MOCK appointments — Firestore vide');
  return liveResult(
    snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppointmentDoc, 'id'>) })),
  );
}

/**
 * Create appointment.
 * - Garage owner: garageOwnerUid must be self.
 * - Client: status=requested + clientUid=self + target garage doc must exist (blocks inbox forge).
 */
export async function createAppointment(
  input: Omit<AppointmentDoc, 'id' | 'createdAt'>,
): Promise<ServiceResult<AppointmentDoc>> {
  const payload: AppointmentDoc = {
    ...input,
    id: `appt-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) {
    mockStore = [payload, ...mockStore];
    return mockResult(payload, 'MOCK appointment create');
  }

  const asGarage = payload.garageOwnerUid === uid;
  const asClient =
    payload.clientUid === uid &&
    payload.status === 'requested' &&
    payload.garageOwnerUid !== uid;

  if (!asGarage && !asClient) {
    return failResult(
      payload,
      'Création RDV refusée — garageOwnerUid doit être vous, ou clientUid=vous + status=requested',
    );
  }

  if (asClient) {
    const garageSnap = await getDoc(doc(fb.db, COLLECTIONS.garages, payload.garageOwnerUid));
    if (!garageSnap.exists() || garageSnap.data()?.ownerUid !== payload.garageOwnerUid) {
      return failResult(
        payload,
        'Création RDV refusée — garage cible inexistant (anti-forge inbox)',
      );
    }
  }

  try {
    const ref = await addDoc(collection(fb.db, COLLECTIONS.appointments), payload);
    return liveResult({ ...payload, id: ref.id });
  } catch (e) {
    return failResult(payload, e instanceof Error ? e.message : 'Création RDV échouée');
  }
}

export async function updateAppointment(
  id: string,
  patch: Partial<Pick<AppointmentDoc, 'status' | 'scheduledAt' | 'notes' | 'estimatedTotal' | 'clientName' | 'vehicleLabel'>>,
): Promise<ServiceResult<AppointmentDoc | null>> {
  const fb = getFirebase();
  if (!fb || !getSignedInUid()) {
    const idx = mockStore.findIndex((a) => a.id === id);
    if (idx < 0) return mockResult(null, 'MOCK — RDV introuvable');
    mockStore[idx] = { ...mockStore[idx], ...patch };
    return mockResult(mockStore[idx], 'MOCK appointment update');
  }
  await updateDoc(doc(fb.db, COLLECTIONS.appointments, id), patch);
  return liveResult({ id, ...patch } as AppointmentDoc);
}

export async function cancelAppointment(id: string): Promise<ServiceResult<AppointmentDoc | null>> {
  return updateAppointment(id, { status: 'cancelled' });
}
