import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { getFirebase } from '../../firebase/config';
import type { MedicalCardDoc, UserDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

const MOCK_CARD: MedicalCardDoc = {
  id: 'mock-med-1',
  ownerUid: 'mock-local-user',
  scanCode: 'UM-DEMO-SCAN-001',
  fullName: 'Utilisateur Démo',
  allergies: ['Pénicilline'],
  conditions: ['Asthme'],
  medications: ['Ventoline'],
  emergencyContacts: [{ name: 'Contact urgence', phone: '+33600000000' }],
  bloodType: 'O+',
  updatedAt: new Date().toISOString(),
};

function canRescuerRead(profile: UserDoc | null | undefined): boolean {
  return Boolean(
    profile &&
      profile.role === 'rescuer' &&
      profile.subscription === 'rescuer' &&
      profile.subscriptionActive,
  );
}

/** Module 13 — owner write; rescuer+subscription read via rules + client gate. */
export async function upsertMedicalCard(
  card: Omit<MedicalCardDoc, 'updatedAt'>,
): Promise<ServiceResult<MedicalCardDoc>> {
  const payload: MedicalCardDoc = { ...card, updatedAt: new Date().toISOString() };
  const fb = getFirebase();
  if (!fb) return mockResult(payload, 'MOCK medical card — stockage local');

  await setDoc(doc(fb.db, COLLECTIONS.medicalCards, card.id), payload, { merge: true });
  return liveResult(payload);
}

export async function getOwnMedicalCard(ownerUid: string): Promise<ServiceResult<MedicalCardDoc | null>> {
  const fb = getFirebase();
  if (!fb) return mockResult(MOCK_CARD, 'MOCK medical card');

  const q = query(collection(fb.db, COLLECTIONS.medicalCards), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  if (snap.empty) return liveResult(null);
  const d = snap.docs[0];
  return liveResult({ id: d.id, ...(d.data() as Omit<MedicalCardDoc, 'id'>) });
}

/**
 * Rescuer scan path — client checks subscription before read.
 * Firestore rules also enforce isActiveRescuer().
 */
export async function scanMedicalCardAsRescuer(
  scanCode: string,
  rescuerProfile: UserDoc | null,
): Promise<ServiceResult<MedicalCardDoc | null>> {
  if (!canRescuerRead(rescuerProfile)) {
    return mockResult(null, 'REFUSÉ — abonnement secours actif + rôle rescuer requis');
  }
  const fb = getFirebase();
  if (!fb) {
    if (scanCode === MOCK_CARD.scanCode) {
      return mockResult(MOCK_CARD, 'MOCK scan secours — fiche démo');
    }
    return mockResult(null, 'MOCK scan — code inconnu');
  }
  const q = query(collection(fb.db, COLLECTIONS.medicalCards), where('scanCode', '==', scanCode));
  const snap = await getDocs(q);
  if (snap.empty) return liveResult(null);
  const d = snap.docs[0];
  return liveResult({ id: d.id, ...(d.data() as Omit<MedicalCardDoc, 'id'>) });
}

export async function getMedicalCardById(
  id: string,
  reader: UserDoc | null,
): Promise<ServiceResult<MedicalCardDoc | null>> {
  if (reader && reader.uid) {
    /* owner or rescuer checked by rules */
  }
  const fb = getFirebase();
  if (!fb) return mockResult(id === MOCK_CARD.id ? MOCK_CARD : null, 'MOCK medical get');
  const snap = await getDoc(doc(fb.db, COLLECTIONS.medicalCards, id));
  return liveResult(snap.exists() ? ({ id: snap.id, ...snap.data() } as MedicalCardDoc) : null);
}
