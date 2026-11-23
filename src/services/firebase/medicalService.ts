/**
 * Module 13 — personal QR per subscriber + scan-scoped rescuer access.
 * - public_limited: SOS hint only (no medical PHI from Firestore)
 * - emergency_full: active rescuer get(medicalScanIndex/{scanCode}) only — never list all cards
 * Printed QR sticker/card only — not AirTag/NFC beacon.
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
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type {
  MedicalCardDoc,
  MedicalEmergencyView,
  MedicalPublicPreview,
  UserDoc,
} from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

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

/** Unpredictable scan code — avoids collision/hijack from uid-derived codes. */
function mintScanCode(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
  return `UM-QR-${rand}`;
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

type ScanIndexDoc = {
  scanCode: string;
  ownerUid: string;
  cardId: string;
  fullName: string;
  address?: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  emergencyContacts: { name: string; phone: string }[];
  bloodType?: string;
  notes?: string;
  updatedAt: string;
};

function indexFromCard(card: MedicalCardDoc): ScanIndexDoc {
  return {
    scanCode: card.scanCode,
    ownerUid: card.ownerUid,
    cardId: card.id,
    fullName: card.fullName,
    address: card.address,
    allergies: card.allergies,
    conditions: card.conditions,
    medications: card.medications,
    emergencyContacts: card.emergencyContacts,
    bloodType: card.bloodType,
    notes: card.notes,
    updatedAt: card.updatedAt,
  };
}

/** Ensure one personal QR per subscriber (unique scanCode + index doc). */
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

  const scanCode = mintScanCode();
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
  if (saved.ok === false) {
    return failResult(
      { scanCode: '', card },
      saved.stubLabel ?? 'Échec création QR (collision scanCode ?)',
    );
  }
  return {
    data: { scanCode: saved.data.scanCode, card: saved.data },
    source: saved.source,
    stubLabel: saved.stubLabel ?? 'QR personnel créé pour ce compte abonné',
    ok: true,
  };
}

/** Module 13 — owner write. Keeps medicalScanIndex/{scanCode} in sync; scanCode immutable. */
export async function upsertMedicalCard(
  card: Omit<MedicalCardDoc, 'updatedAt'>,
): Promise<ServiceResult<MedicalCardDoc>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  const scanCode = (card.scanCode || mintScanCode()).trim().toUpperCase();
  const payload: MedicalCardDoc = {
    ...card,
    scanCode,
    updatedAt: new Date().toISOString(),
  };

  if (!fb || !uid || uid !== card.ownerUid) {
    return mockResult(payload, 'MOCK medical — QR/fiche locale (ou non connecté)');
  }

  try {
    const cardRef = doc(fb.db, COLLECTIONS.medicalCards, card.id);
    const existingCard = await getDoc(cardRef);
    if (existingCard.exists()) {
      const prev = existingCard.data() as MedicalCardDoc;
      // Enforce immutability client-side (rules also enforce)
      payload.scanCode = prev.scanCode;
    } else {
      const indexRef = doc(fb.db, COLLECTIONS.medicalScanIndex, scanCode);
      const clash = await getDoc(indexRef);
      if (clash.exists() && clash.data()?.ownerUid !== uid) {
        return failResult(payload, 'scanCode déjà utilisé — collision / hijack bloqué');
      }
      await setDoc(indexRef, indexFromCard(payload));
    }

    await setDoc(cardRef, payload, { merge: true });
    // Refresh index PHI for rescuer scan-get (same scanCode)
    await setDoc(doc(fb.db, COLLECTIONS.medicalScanIndex, payload.scanCode), indexFromCard(payload), {
      merge: true,
    });
    return liveResult(payload);
  } catch (e) {
    return failResult(
      payload,
      e instanceof Error ? e.message : 'Échec écriture fiche médicale',
    );
  }
}

export async function getOwnMedicalCard(ownerUid: string): Promise<ServiceResult<MedicalCardDoc | null>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) {
    return mockResult(
      { ...MOCK_CARD, ownerUid, scanCode: MOCK_CARD.scanCode },
      'MOCK medical card — QR personnel démo',
    );
  }

  const q = query(collection(fb.db, COLLECTIONS.medicalCards), where('ownerUid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) return liveResult(null);
  const d = snap.docs[0];
  return liveResult({ id: d.id, ...(d.data() as Omit<MedicalCardDoc, 'id'>) });
}

/**
 * Anonymous / public camera scan → limited preview only (no PHI).
 * Does not list or read medicalCards — static SOS payload for any UM-QR-* code.
 */
export async function scanMedicalPublic(
  scanCode: string,
): Promise<ServiceResult<MedicalPublicPreview | null>> {
  const code = scanCode.trim().toUpperCase();
  if (!code) return mockResult(null, 'Code QR vide');
  if (!code.startsWith('UM-QR-')) return mockResult(null, 'QR inconnu');
  return liveResult(toPublicPreview(code), 'Vue publique limitée — pas de PHI');
}

/**
 * Authorized emergency scan → get(medicalScanIndex/{scanCode}) only.
 * Rules deny list on that collection — rescuer cannot dump all cards.
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

  try {
    // Exact document get by scanCode — not a collection list
    const snap = await getDoc(doc(fb.db, COLLECTIONS.medicalScanIndex, code));
    if (!snap.exists()) return liveResult(null);
    const idx = snap.data() as ScanIndexDoc;
    return liveResult(
      toEmergencyView({
        id: idx.cardId,
        ownerUid: idx.ownerUid,
        scanCode: idx.scanCode,
        fullName: idx.fullName,
        address: idx.address,
        allergies: idx.allergies ?? [],
        conditions: idx.conditions ?? [],
        medications: idx.medications ?? [],
        emergencyContacts: idx.emergencyContacts ?? [],
        bloodType: idx.bloodType,
        notes: idx.notes,
        updatedAt: idx.updatedAt,
      }),
    );
  } catch (e) {
    return failResult(null, e instanceof Error ? e.message : 'Scan urgence refusé');
  }
}

/** @deprecated Prefer scanMedicalEmergency — kept for older screens. */
export async function scanMedicalCardAsRescuer(
  scanCode: string,
  rescuerProfile: UserDoc | null,
): Promise<ServiceResult<MedicalCardDoc | null>> {
  const full = await scanMedicalEmergency(scanCode, rescuerProfile);
  if (!full.data) {
    return { data: null, source: full.source, stubLabel: full.stubLabel, ok: full.ok };
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
  return { data: card, source: full.source, stubLabel: full.stubLabel, ok: full.ok };
}

/** Owner-only get by id — rescuers must use scanMedicalEmergency(scanCode). */
export async function getMedicalCardById(
  id: string,
  reader: UserDoc | null,
): Promise<ServiceResult<MedicalCardDoc | null>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) return mockResult(id === MOCK_CARD.id ? MOCK_CARD : null, 'MOCK medical get');
  if (reader && reader.role === 'rescuer' && reader.uid !== uid) {
    return failResult(null, 'Rescuer: utiliser le scan QR (scanCode), pas getById');
  }
  try {
    const snap = await getDoc(doc(fb.db, COLLECTIONS.medicalCards, id));
    if (!snap.exists()) return liveResult(null);
    const card = { id: snap.id, ...snap.data() } as MedicalCardDoc;
    if (card.ownerUid !== uid) return failResult(null, 'Accès fiche médicale refusé');
    return liveResult(card);
  } catch (e) {
    return failResult(null, e instanceof Error ? e.message : 'Lecture fiche refusée');
  }
}
