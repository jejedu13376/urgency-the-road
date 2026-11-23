import { addDoc, collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { getFirebase } from '../../firebase/config';
import type { AppointmentDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

const MOCK_APPTS: AppointmentDoc[] = [
  {
    id: 'a1',
    garageOwnerUid: 'garage-pro-1',
    clientName: 'Martin D.',
    vehicleLabel: 'Clio V',
    status: 'confirmed',
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    estimatedTotal: 340,
    currency: 'EUR',
    createdAt: new Date().toISOString(),
  },
];

/** Module 17 — Pro garagistes appointments */
export async function listAppointmentsForGarage(
  garageOwnerUid: string,
): Promise<ServiceResult<AppointmentDoc[]>> {
  const fb = getFirebase();
  if (!fb) return mockResult(MOCK_APPTS, 'MOCK appointments Pro');

  const snap = await getDocs(
    query(
      collection(fb.db, COLLECTIONS.appointments),
      where('garageOwnerUid', '==', garageOwnerUid),
      orderBy('scheduledAt', 'asc'),
      limit(40),
    ),
  );
  if (snap.empty) return mockResult(MOCK_APPTS, 'MOCK appointments — Firestore vide');
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
  if (!fb) return mockResult(payload, 'MOCK appointment create');
  const ref = await addDoc(collection(fb.db, COLLECTIONS.appointments), payload);
  return liveResult({ ...payload, id: ref.id });
}
