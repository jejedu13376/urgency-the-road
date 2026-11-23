/**
 * Module 13 — personal QR per subscriber + scan-scoped rescuer access.
 * - public_limited: SOS hint only (no medical PHI from Firestore)
 * - emergency_full: active rescuer get(medicalScanIndex/{scanCode}) only — never list all cards
 * Printed QR sticker/card only — not AirTag/NFC beacon.
 */
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type {
  MedicalCardDoc,
  MedicalEmergencyView,
  MedicalPublicPreview,
  UserDoc,
} from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { isDevSoftAuth, isPermissionDenied } from './devSoftAuth';
import { failResult, flaggedDemoResult, liveResult, mockResult, ServiceResult } from './result';

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

/** Unpredictable scan code — UM-QR- + ≥16 A-Z0-9 (matches firestore isOpaqueScanCode). */
function mintScanCode(): string {
  let rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '');
  while (rand.length < 16) {
    rand += Math.random().toString(36).slice(2).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  return `UM-QR-${rand.slice(0, 16)}`;
}

/** Reject UM-QR-{uid[0:8]} (and similar) — rescuers must not guess PHI from public uids. */
function isUidDerivedScanCode(code: string, uid: string): boolean {
  const c = code.trim().toUpperCase();
  if (!c || !uid) return false;
  const slice8 = uid.slice(0, 8).toUpperCase();
  const slice12 = uid.slice(0, 12).toUpperCase();
  return (
    c === `UM-QR-${slice8}` ||
    c === `UM-QR-${slice12}` ||
    c === `UM-QR-${uid.toUpperCase()}` ||
    c === uid.toUpperCase()
  );
}

/** Client mirror of firestore.rules isOpaqueScanCode — UM-QR- + ≥16 A-Z0-9. */
function isOpaqueScanCode(code: string): boolean {
  return /^UM-QR-[A-Z0-9]{16,}$/.test(code.trim().toUpperCase());
}

/** Keep only rule-compliant opaque codes; remint empty, uid-derived, or weak/short. */
function resolveOpaqueScanCode(requested: string, uid: string): string {
  const code = requested.trim().toUpperCase();
  if (!code || isUidDerivedScanCode(code, uid) || !isOpaqueScanCode(code)) {
    return mintScanCode();
  }
  return code;
}

/** True when an existing card/index code is safe to keep (opaque + not uid-derived). */
function canReuseScanCode(code: string | null | undefined, uid: string): boolean {
  if (!code) return false;
  const c = code.trim().toUpperCase();
  return isOpaqueScanCode(c) && !isUidDerivedScanCode(c, uid);
}

function canRescuerFull(profile: UserDoc | null | undefined): boolean {
  if (
    profile &&
    profile.role === 'rescuer' &&
    profile.subscription === 'rescuer' &&
    profile.subscriptionActive
  ) {
    return true;
  }
  // DEV soft-path: rescuer role without subscriptionActive / KYC still loads UI
  // (no hard approve workflow). Non-rescuer stays denied.
  return Boolean(isDevSoftAuth() && profile?.role === 'rescuer');
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
      'Scan public limité : choisissez un n° d’urgence (112 universal/EU, 000 AU, 911 NA). Données médicales réservées aux intervenants autorisés.',
    /** Suggested default only — UI shows the full regional dial list. */
    emergencyDial: '112',
  };
}

type ScanIndexDoc = {
  scanCode: string;
  ownerUid: string;
  cardId: string;
  subscriberActive: boolean;
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

/**
 * Full-replace payload for setDoc (no merge).
 * Omit empty optionals — deleteField() is invalid without merge/updateDoc,
 * and a full overwrite already drops keys that are not present.
 */
function cardWritePayload(card: MedicalCardDoc): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ownerUid: card.ownerUid,
    scanCode: card.scanCode,
    fullName: card.fullName,
    allergies: card.allergies ?? [],
    conditions: card.conditions ?? [],
    medications: card.medications ?? [],
    emergencyContacts: card.emergencyContacts ?? [],
    subscriberActive: card.subscriberActive ?? true,
    updatedAt: card.updatedAt,
  };
  const address = card.address?.trim();
  const bloodType = card.bloodType?.trim();
  const notes = card.notes?.trim();
  if (address) payload.address = address;
  if (bloodType) payload.bloodType = bloodType;
  if (notes) payload.notes = notes;
  return payload;
}

/**
 * Index write: active subscriber → full PHI for rescuer get;
 * inactive → ownership reservation only (no PHI). Rules deny rescuer get when inactive.
 */
function indexFromCard(card: MedicalCardDoc): Record<string, unknown> {
  const active = Boolean(card.subscriberActive);
  if (!active) {
    return {
      scanCode: card.scanCode,
      ownerUid: card.ownerUid,
      cardId: card.id,
      subscriberActive: false,
      fullName: '',
      allergies: [],
      conditions: [],
      medications: [],
      emergencyContacts: [],
      updatedAt: card.updatedAt,
    };
  }
  const payload: Record<string, unknown> = {
    scanCode: card.scanCode,
    ownerUid: card.ownerUid,
    cardId: card.id,
    subscriberActive: true,
    fullName: card.fullName,
    allergies: card.allergies ?? [],
    conditions: card.conditions ?? [],
    medications: card.medications ?? [],
    emergencyContacts: card.emergencyContacts ?? [],
    updatedAt: card.updatedAt,
  };
  const address = card.address?.trim();
  const bloodType = card.bloodType?.trim();
  const notes = card.notes?.trim();
  if (address) payload.address = address;
  if (bloodType) payload.bloodType = bloodType;
  if (notes) payload.notes = notes;
  return payload;
}

/** Ensure one personal QR per subscriber (unique scanCode + index doc). */
export async function ensurePersonalQr(
  ownerUid: string,
  subscriberActive: boolean,
): Promise<ServiceResult<{ scanCode: string; card: MedicalCardDoc }>> {
  if (!subscriberActive) {
    // Empty QR + flagged shell — ok:false so form does not hydrate as live PHI.
    return flaggedDemoResult(
      { scanCode: '', card: { ...MOCK_CARD, ownerUid, scanCode: '', subscriberActive: false } },
      'DEMO — QR réservé abonnés (ok:false, pas live PHI)',
    );
  }

  const existing = await getOwnMedicalCard(ownerUid);
  // Transient / permission / flagged-demo read — never upsert demo PHI as live.
  if (existing.ok === false) {
    return failResult(
      {
        scanCode: '',
        card: { ...MOCK_CARD, ownerUid, scanCode: '', subscriberActive: true },
      },
      existing.stubLabel ?? 'Lecture fiche médicale échouée — pas de mint QR',
    );
  }
  if (existing.data?.scanCode) {
    if (existing.source === 'mock') {
      return flaggedDemoResult(
        { scanCode: existing.data.scanCode, card: existing.data },
        existing.stubLabel ?? 'DEMO QR personnel existant (ok:false, pas live)',
      );
    }
    // Refresh index (subscriberActive + PHI) without reminting — keeps legacy QR rescuer-readable
    const refreshed = await upsertMedicalCard({
      ...existing.data,
      subscriberActive: true,
    });
    if (refreshed.ok === false) {
      return failResult(
        { scanCode: existing.data.scanCode, card: existing.data },
        refreshed.stubLabel ?? 'Échec refresh index QR',
      );
    }
    return liveResult(
      { scanCode: refreshed.data.scanCode, card: refreshed.data },
      'QR personnel existant — index rafraîchi',
    );
  }

  // Confirmed missing card (liveResult(null)) — mint new QR only in that case.
  const scanCode = mintScanCode();
  const cardId = `med-${ownerUid}`;
  const card: MedicalCardDoc = {
    id: cardId,
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

/** Canonical medical card doc id — matches rules (uid or med-{uid}). */
export function medicalCardDocId(ownerUid: string): string {
  return `med-${ownerUid}`;
}

/**
 * Module 13 — owner write.
 * Remint / create-with-new-code: index-first → card → delete old; claimedNewIndex rollback on fail.
 * Same-code update: card then refresh owned index (reservation stub or full PHI).
 * Inactive: reservation index without PHI; rescuer get also checks frozen users.subscriptionActive.
 */
export async function upsertMedicalCard(
  card: Omit<MedicalCardDoc, 'updatedAt'>,
): Promise<ServiceResult<MedicalCardDoc>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  const ownerUid = uid ?? card.ownerUid;
  // Force path under caller's slot — cannot occupy med-{victim}
  const cardId = medicalCardDocId(ownerUid);
  const payload: MedicalCardDoc = {
    ...card,
    id: cardId,
    ownerUid,
    scanCode: resolveOpaqueScanCode(card.scanCode || '', ownerUid),
    updatedAt: new Date().toISOString(),
  };

  if (!fb || !uid || uid !== card.ownerUid) {
    return mockResult(payload, 'MOCK medical — QR/fiche locale (ou non connecté)');
  }

  let claimedNewIndex: string | null = null;

  try {
    const cardRef = doc(fb.db, COLLECTIONS.medicalCards, cardId);
    const legacyRef = doc(fb.db, COLLECTIONS.medicalCards, uid);
    const existingCard = await getDoc(cardRef);
    const legacyCard = existingCard.exists() ? null : await getDoc(legacyRef);

    let previousScanCode: string | null = null;
    const cardExists = existingCard.exists();

    if (cardExists) {
      const prev = existingCard.data() as MedicalCardDoc;
      previousScanCode = prev.scanCode || null;
      payload.scanCode = canReuseScanCode(prev.scanCode, uid)
        ? prev.scanCode.trim().toUpperCase()
        : mintScanCode();
    } else if (legacyCard?.exists()) {
      const prev = legacyCard.data() as MedicalCardDoc;
      previousScanCode = prev.scanCode || null;
      payload.scanCode = canReuseScanCode(prev.scanCode, uid)
        ? prev.scanCode.trim().toUpperCase()
        : mintScanCode();
    } else {
      payload.scanCode = resolveOpaqueScanCode(payload.scanCode, uid);
      const probe = await getDoc(doc(fb.db, COLLECTIONS.medicalScanIndex, payload.scanCode));
      if (probe.exists()) {
        const owner = (probe.data() as { ownerUid?: string })?.ownerUid;
        if (owner === uid) {
          const existingCode =
            (probe.data() as { scanCode?: string }).scanCode ?? payload.scanCode;
          if (canReuseScanCode(existingCode, uid)) {
            payload.scanCode = existingCode.trim().toUpperCase();
          } else {
            previousScanCode = existingCode;
            payload.scanCode = mintScanCode();
          }
        } else {
          return failResult(payload, 'scanCode déjà utilisé — collision / hijack bloqué');
        }
      }
    }

    const rotating =
      Boolean(previousScanCode) && previousScanCode !== payload.scanCode;
    const indexPayload = indexFromCard({ ...payload, id: cardId, scanCode: payload.scanCode });
    const newIndexRef = doc(fb.db, COLLECTIONS.medicalScanIndex, payload.scanCode);

    /** Returns true when the target index already exists and is owned by caller. */
    const assertIndexOwnedOrFree = async (): Promise<boolean> => {
      const snap = await getDoc(newIndexRef);
      if (!snap.exists()) return false;
      const owner = (snap.data() as { ownerUid?: string })?.ownerUid;
      if (owner && owner !== uid) {
        throw new Error('Index scanCode appartient à un autre compte');
      }
      return true;
    };

    if (rotating && previousScanCode) {
      // Index-first for both update and legacy create (create rule allows owned leftover index)
      await assertIndexOwnedOrFree();
      await setDoc(newIndexRef, indexPayload);
      claimedNewIndex = payload.scanCode;
      await setDoc(cardRef, cardWritePayload(payload));
      claimedNewIndex = null;
      try {
        await deleteDoc(doc(fb.db, COLLECTIONS.medicalScanIndex, previousScanCode));
      } catch {
        /* non-fatal */
      }
    } else if (cardExists) {
      await setDoc(cardRef, cardWritePayload(payload));
      await assertIndexOwnedOrFree();
      await setDoc(newIndexRef, indexPayload);
    } else {
      // Brand-new / legacy migrate keeping same code: index-first then card.
      // Only claim rollback when we create a NEW index — never delete a pre-owned live QR.
      const indexPreexistedOwned = await assertIndexOwnedOrFree();
      await setDoc(newIndexRef, indexPayload);
      if (!indexPreexistedOwned) {
        claimedNewIndex = payload.scanCode;
      }
      await setDoc(cardRef, cardWritePayload(payload));
      claimedNewIndex = null;
    }

    // Migrate: drop legacy uid-keyed doc only after canonical write succeeded
    if (legacyCard?.exists() && legacyRef.id !== cardRef.id) {
      try {
        await deleteDoc(legacyRef);
      } catch {
        /* non-fatal */
      }
    }

    const stub = payload.subscriberActive
      ? undefined
      : 'Fiche enregistrée — index réservé sans PHI (abonné inactif)';
    return liveResult(payload, stub);
  } catch (e) {
    if (claimedNewIndex) {
      try {
        const fb2 = getFirebase();
        if (fb2) {
          await deleteDoc(doc(fb2.db, COLLECTIONS.medicalScanIndex, claimedNewIndex));
        }
      } catch {
        /* best-effort orphan cleanup */
      }
    }
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
    // Flagged demo PHI — ok:false so UI never treats it as live Firestore.
    return flaggedDemoResult(
      { ...MOCK_CARD, ownerUid, id: medicalCardDocId(ownerUid), scanCode: MOCK_CARD.scanCode },
      'DEMO medical card — QR démo (ok:false, pas live)',
    );
  }

  try {
    // Prefer canonical path med-{uid}; fall back to uid-keyed doc
    for (const id of [medicalCardDocId(uid), uid]) {
      const snap = await getDoc(doc(fb.db, COLLECTIONS.medicalCards, id));
      if (snap.exists()) {
        const raw = snap.data() as Omit<MedicalCardDoc, 'id'>;
        // Normalize arrays — incomplete Firestore docs must not crash hydrateForm .join().
        return liveResult({
          id: snap.id,
          ...raw,
          allergies: raw.allergies ?? [],
          conditions: raw.conditions ?? [],
          medications: raw.medications ?? [],
          emergencyContacts: raw.emergencyContacts ?? [],
        });
      }
    }
    return liveResult(null);
  } catch (e) {
    // Soft-fail: ok:false + null — NEVER mockResult(ok:true) with PHI.
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return failResult(
        null,
        isPermissionDenied(e)
          ? 'SOFT medical — permission refusée (pas de PHI mock, UI charge)'
          : 'SOFT medical — DEV (pas de fiche, pas de PHI inventé)',
      );
    }
    return failResult(null, e instanceof Error ? e.message : 'Lecture fiche médicale refusée');
  }
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
  const softDev = isDevSoftAuth();
  if (!canRescuerFull(rescuerProfile)) {
    // Soft deny: ok:false + null — UI loads, no fake PHI.
    return failResult(
      null,
      softDev
        ? 'SOFT REFUSÉ — rescuer/KYC (DEV, pas de crash, pas de PHI)'
        : 'REFUSÉ — vue urgence complète : rôle rescuer + abonnement secours actif + KYC',
    );
  }

  const code = scanCode.trim().toUpperCase();
  const fb = getFirebase();
  if (!fb) {
    // Only the exact demo scan code returns flagged demo PHI — never any UM-QR-* prefix.
    if (code === MOCK_CARD.scanCode.toUpperCase()) {
      return flaggedDemoResult(
        toEmergencyView({ ...MOCK_CARD }),
        'DEMO vue urgence (code démo) — ok:false, pas live PHI',
      );
    }
    return softDev
      ? failResult(null, 'SOFT vue urgence — Firebase off / QR non démo (pas de PHI)')
      : mockResult(null, 'QR inconnu (mock — seul le code démo renvoie une fiche)');
  }

  try {
    // Exact document get by scanCode — not a collection list
    const snap = await getDoc(doc(fb.db, COLLECTIONS.medicalScanIndex, code));
    if (!snap.exists()) {
      // Demo code only when Firebase empty — flagged ok:false, never invent for other codes.
      if (code === MOCK_CARD.scanCode.toUpperCase()) {
        return flaggedDemoResult(
          toEmergencyView({ ...MOCK_CARD }),
          'DEMO vue urgence — index absent, code démo (ok:false, pas live)',
        );
      }
      return liveResult(null);
    }
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
    // Soft-fail: ok:false + null — NEVER surface MOCK_CARD as live PHI.
    if (isPermissionDenied(e) || softDev) {
      return failResult(
        null,
        isPermissionDenied(e)
          ? 'SOFT vue urgence — permission refusée (pas de PHI mock, UI charge)'
          : 'SOFT vue urgence — DEV (pas de PHI inventé)',
      );
    }
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
