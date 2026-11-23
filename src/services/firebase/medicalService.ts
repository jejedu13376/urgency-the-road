/**
 * Module 13 — personal QR per subscriber account + controlled access.
 * - public_limited: anonymous camera scan → SOS hint only (no medical PHI)
 * - emergency_full: authorized rescuer → name, address, emergency contact, full fiche
 * Printed QR sticker/card only — not an electronic beacon product.
 * Distinct from OBD valise (M5) and vehicle diagnostic hardware (future).
 */
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
import type {
  MedicalCardDoc,
  MedicalEmergencyView,
  MedicalPublicPreview,
  UserDoc,
} from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

const MOCK_CARD: MedicalCardDoc = {
  id: 'mock-med-1',
  ownerUid: 'mock-local-user',
  scanCode: 'UM-QR-SUB-DEMO-001',
  fullName: 'Utilisateur Démo',
  address: '12 rue des Lilas, 59000 Lille, France',
  allergies: ['Pénicilline'],
  conditions: ['Asthme'],
  medications: ['Ventoline'],
  emergencyContacts: [{ name: 'Contact urgence', phone: '+33600000000' }],
  bloodType: 'O+',
  subscriberActive: true,
  updatedAt: new Date().toISOString(),
};

function personalQrForUid(uid: string): string {
  const slug = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase() || 'LOCAL';
  return `UM-QR-${slug}`;
}

function canRescuerFull(profile: UserDoc | null | undefined): boolean {
  return Boolean(
    profile &&
      profile.role === 'rescuer' &&
      profile.subscription === 'rescuer' &&
      profile.subscriptionActive,
  );
}

function toEmergencyView(card: MedicalCardDoc): MedicalEmergencyView {
  return {
    kind: 'emergency_full',
    scanCode: card.scanCode,
    fullName: card.fullName,
    address: card.address ?? 'Adresse non renseignée',
    emergencyContact: card.emergencyContacts[0] ?? null,
    bloodType: card.bloodType,
    allergies: card.allergies,
    conditions: card.conditions,
    medications: card.medications,
    notes: card.notes,
  };
}

function toPublicPreview(scanCode: string): MedicalPublicPreview {
  return {
    kind: 'public_limited',
    scanCode,
    brandLabel: 'Urgence Mécanique — fiche médicale',
    sosHint:
      'Scan public limité : appelez les secours (112). Données médicales réservées aux intervenants autorisés.',
    emergencyDial: '112',
  };
}

/** Ensure one personal QR code per subscriber account (mint / persist). */
export async function ensurePersonalQr(
  ownerUid: string,
  subscriberActive: boolean,
): Promise<ServiceResult<{ scanCode: string; card: MedicalCardDoc }>> {
  if (!subscriberActive) {
    return mockResult(
      { scanCode: '', card: { ...MOCK_CARD, ownerUid, scanCode: '', subscriberActive: false } },
      'QR personnel réservé aux comptes abonnés actifs',
    );
  }

  const existing = await getOwnMedicalCard(ownerUid);
  if (existing.data?.scanCode) {
    if (existing.source === 'mock') {
      return mockResult(
        { scanCode: existing.data.scanCode, card: existing.data },
        existing.stubLabel ?? 'QR personnel existant (mock)',
      );
    }
    return liveResult({ scanCode: existing.data.scanCode, card: existing.data });
  }

  const scanCode = personalQrForUid(ownerUid);
  const card: MedicalCardDoc = {
    id: `med-${ownerUid}`,
    ownerUid,
    scanCode,
    fullName: MOCK_CARD.fullName,
    address: MOCK_CARD.address,
    allergies: [],
    conditions: [],
    medications: [],
    emergencyContacts: [],
    subscriberActive: true,
    updatedAt: new Date().toISOString(),
  };
  const saved = await upsertMedicalCard(card);
  return {
    data: { scanCode, card: saved.data },
    source: saved.source,
    stubLabel: saved.stubLabel ?? 'QR personnel créé pour ce compte abonné',
  };
}

/** Module 13 — owner write. */
export async function upsertMedicalCard(
  card: Omit<MedicalCardDoc, 'updatedAt'>,
): Promise<ServiceResult<MedicalCardDoc>> {
  const payload: MedicalCardDoc = {
    ...card,
    scanCode: card.scanCode || personalQrForUid(card.ownerUid),
    updatedAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  if (!fb) return mockResult(payload, 'MOCK medical — QR/fiche locale');

  await setDoc(doc(fb.db, COLLECTIONS.medicalCards, card.id), payload, { merge: true });
  return liveResult(payload);
}

export async function getOwnMedicalCard(ownerUid: string): Promise<ServiceResult<MedicalCardDoc | null>> {
  const fb = getFirebase();
  if (!fb) {
    return mockResult(
      { ...MOCK_CARD, ownerUid, scanCode: personalQrForUid(ownerUid) },
      'MOCK medical card — QR personnel démo',
    );
  }

  const q = query(collection(fb.db, COLLECTIONS.medicalCards), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  if (snap.empty) return liveResult(null);
  const d = snap.docs[0];
  return liveResult({ id: d.id, ...(d.data() as Omit<MedicalCardDoc, 'id'>) });
}

/**
 * Anonymous / public camera scan → limited preview only (no PHI).
 */
export async function scanMedicalPublic(
  scanCode: string,
): Promise<ServiceResult<MedicalPublicPreview | null>> {
  const code = scanCode.trim().toUpperCase();
  if (!code) return mockResult(null, 'Code QR vide');

  const fb = getFirebase();
  if (!fb) {
    if (code === MOCK_CARD.scanCode.toUpperCase() || code.startsWith('UM-QR-')) {
      return mockResult(toPublicPreview(code), 'Vue publique limitée (mock)');
    }
    return mockResult(null, 'QR inconnu');
  }

  const q = query(collection(fb.db, COLLECTIONS.medicalCards), where('scanCode', '==', code));
  const snap = await getDocs(q);
  if (snap.empty) return liveResult(null);
  return liveResult(toPublicPreview(code));
}

/**
 * Authorized emergency scan → name, address, emergency contact, full medical fiche.
 * Client gate + Firestore isActiveRescuer() rules.
 */
export async function scanMedicalEmergency(
  scanCode: string,
  rescuerProfile: UserDoc | null,
): Promise<ServiceResult<MedicalEmergencyView | null>> {
  if (!canRescuerFull(rescuerProfile)) {
    return mockResult(
      null,
      'REFUSÉ — vue urgence complète : rôle rescuer + abonnement secours actif + KYC',
    );
  }

  const code = scanCode.trim().toUpperCase();
  const fb = getFirebase();
  if (!fb) {
    if (code === MOCK_CARD.scanCode.toUpperCase() || code.startsWith('UM-QR-')) {
      return mockResult(toEmergencyView({ ...MOCK_CARD, scanCode: code }), 'MOCK vue urgence complète');
    }
    return mockResult(null, 'QR inconnu');
  }

  const q = query(collection(fb.db, COLLECTIONS.medicalCards), where('scanCode', '==', code));
  const snap = await getDocs(q);
  if (snap.empty) return liveResult(null);
  const d = snap.docs[0];
  const card = { id: d.id, ...(d.data() as Omit<MedicalCardDoc, 'id'>) };
  return liveResult(toEmergencyView(card));
}

/** @deprecated Prefer scanMedicalEmergency — kept for older screens. */
export async function scanMedicalCardAsRescuer(
  scanCode: string,
  rescuerProfile: UserDoc | null,
): Promise<ServiceResult<MedicalCardDoc | null>> {
  const full = await scanMedicalEmergency(scanCode, rescuerProfile);
  if (!full.data) {
    return { data: null, source: full.source, stubLabel: full.stubLabel };
  }
  const card: MedicalCardDoc = {
    id: `view-${full.data.scanCode}`,
    ownerUid: 'unknown',
    scanCode: full.data.scanCode,
    fullName: full.data.fullName,
    address: full.data.address,
    allergies: full.data.allergies,
    conditions: full.data.conditions,
    medications: full.data.medications,
    emergencyContacts: full.data.emergencyContact ? [full.data.emergencyContact] : [],
    bloodType: full.data.bloodType,
    notes: full.data.notes,
    updatedAt: new Date().toISOString(),
  };
  return { data: card, source: full.source, stubLabel: full.stubLabel };
}

export async function getMedicalCardById(
  id: string,
  _reader: UserDoc | null,
): Promise<ServiceResult<MedicalCardDoc | null>> {
  const fb = getFirebase();
  if (!fb) return mockResult(id === MOCK_CARD.id ? MOCK_CARD : null, 'MOCK medical get');
  const snap = await getDoc(doc(fb.db, COLLECTIONS.medicalCards, id));
  return liveResult(snap.exists() ? ({ id: snap.id, ...snap.data() } as MedicalCardDoc) : null);
}
