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
import { getFirebase } from '../../firebase/config';
import type { AppointmentDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

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
  if (!fb) {
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

export async function createAppointment(
  input: Omit<AppointmentDoc, 'id' | 'createdAt'>,
): Promise<ServiceResult<AppointmentDoc>> {
  const payload: AppointmentDoc = {
    ...input,
    id: `appt-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  if (!fb) {
    mockStore = [payload, ...mockStore];
    return mockResult(payload, 'MOCK appointment create');
  }
  const ref = await addDoc(collection(fb.db, COLLECTIONS.appointments), payload);
  return liveResult({ ...payload, id: ref.id });
}

export async function updateAppointment(
  id: string,
  patch: Partial<Pick<AppointmentDoc, 'status' | 'scheduledAt' | 'notes' | 'estimatedTotal' | 'clientName' | 'vehicleLabel'>>,
): Promise<ServiceResult<AppointmentDoc | null>> {
  const fb = getFirebase();
  if (!fb) {
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
