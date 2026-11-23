import {
  addDoc,
  collection,
  doc,
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

  try {
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
  } catch (e) {
    // Empty list + ok:false — never surface mock RDVs as live data on signed-in errors.
    return failResult([], e instanceof Error ? e.message : 'Lecture RDV refusée');
  }
}

/**
 * Create appointment — garage owner only (garageOwnerUid must be the signed-in uid).
 * Prevents any account from flooding another Pro inbox. Client booking = Cloud Function later.
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

  if (payload.garageOwnerUid !== uid) {
    return failResult(
      payload,
      'Création RDV refusée — seul le garage (garageOwnerUid=vous) peut écrire dans sa boîte',
    );
  }

  try {
    const ref = await addDoc(collection(fb.db, COLLECTIONS.appointments), {
      ...payload,
      garageOwnerUid: uid,
    });
    return liveResult({ ...payload, id: ref.id, garageOwnerUid: uid });
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
  try {
    await updateDoc(doc(fb.db, COLLECTIONS.appointments, id), patch);
    return liveResult({ id, ...patch } as AppointmentDoc);
  } catch (e) {
    return failResult(null, e instanceof Error ? e.message : 'Mise à jour RDV refusée');
  }
}

export async function cancelAppointment(id: string): Promise<ServiceResult<AppointmentDoc | null>> {
  return updateAppointment(id, { status: 'cancelled' });
}
