/**
 * Module 13 — on-device medical QR store (owner fiche only).
 * Scoped per signed-in uid. Never caches third-party rescuer PHI.
 * Cleared on sign-out. Legacy process-wide key is migrated then removed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSignedInUid } from '../../firebase/config';
import type { MedicalCardDoc } from '../../types/firestore';

/** @deprecated Unscoped key — migrated away on first read/write. */
export const MEDICAL_LOCAL_KEY_LEGACY = 'um.urgence.medicalQr.v1';

export function medicalLocalKeyForUid(uid: string): string {
  return `um.urgence.medicalQr.v1:${uid}`;
}

type LocalMedicalStore = {
  /** Owner fiche only (at most one personal QR). */
  card: MedicalCardDoc | null;
  updatedAt: string;
};

function emptyStore(): LocalMedicalStore {
  return { card: null, updatedAt: new Date().toISOString() };
}

async function readStoreForUid(uid: string): Promise<LocalMedicalStore> {
  try {
    const raw = await AsyncStorage.getItem(medicalLocalKeyForUid(uid));
    if (raw) {
      const parsed = JSON.parse(raw) as LocalMedicalStore & {
        byScanCode?: Record<string, MedicalCardDoc>;
        byOwnerUid?: Record<string, string>;
      };
      if (parsed.card) {
        return { card: parsed.card, updatedAt: parsed.updatedAt ?? new Date().toISOString() };
      }
      // Migrate mid-PR shape if present under scoped key.
      const code = parsed.byOwnerUid?.[uid];
      const card = code ? parsed.byScanCode?.[code] ?? null : null;
      return { card, updatedAt: parsed.updatedAt ?? new Date().toISOString() };
    }

    // One-shot migrate from legacy process-wide key, then delete it.
    const legacyRaw = await AsyncStorage.getItem(MEDICAL_LOCAL_KEY_LEGACY);
    if (!legacyRaw) return emptyStore();
    const legacy = JSON.parse(legacyRaw) as {
      byScanCode?: Record<string, MedicalCardDoc>;
      byOwnerUid?: Record<string, string>;
      card?: MedicalCardDoc | null;
      updatedAt?: string;
    };
    const code = legacy.byOwnerUid?.[uid];
    const card =
      legacy.card?.ownerUid === uid
        ? legacy.card
        : code
          ? legacy.byScanCode?.[code] ?? null
          : null;
    const migrated: LocalMedicalStore = {
      card: card && card.ownerUid === uid ? card : null,
      updatedAt: legacy.updatedAt ?? new Date().toISOString(),
    };
    if (migrated.card) {
      await AsyncStorage.setItem(medicalLocalKeyForUid(uid), JSON.stringify(migrated));
    }
    await AsyncStorage.removeItem(MEDICAL_LOCAL_KEY_LEGACY);
    return migrated;
  } catch {
    return emptyStore();
  }
}

async function writeStoreForUid(uid: string, store: LocalMedicalStore): Promise<void> {
  await AsyncStorage.setItem(
    medicalLocalKeyForUid(uid),
    JSON.stringify({ ...store, updatedAt: new Date().toISOString() }),
  );
}

/** True when `a` is a strictly newer ISO timestamp than `b`. */
export function isIsoNewer(a?: string, b?: string): boolean {
  if (!a) return false;
  if (!b) return true;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta)) return false;
  if (Number.isNaN(tb)) return true;
  return ta > tb;
}

/**
 * Persist the signed-in owner's fiche only.
 * Refuses third-party / unsigned cards so rescuer scans never land in AsyncStorage.
 */
export async function saveMedicalCardLocal(card: MedicalCardDoc): Promise<MedicalCardDoc> {
  const uid = getSignedInUid();
  const code = card.scanCode.trim().toUpperCase();
  if (!uid || !code.startsWith('UM-QR-') || card.ownerUid !== uid) {
    return card;
  }
  const normalized: MedicalCardDoc = {
    ...card,
    ownerUid: uid,
    scanCode: code,
    allergies: card.allergies ?? [],
    conditions: card.conditions ?? [],
    medications: card.medications ?? [],
    emergencyContacts: card.emergencyContacts ?? [],
    updatedAt: card.updatedAt || new Date().toISOString(),
  };
  await writeStoreForUid(uid, { card: normalized, updatedAt: normalized.updatedAt });
  return normalized;
}

export async function loadMedicalCardByScanCode(
  scanCode: string,
): Promise<MedicalCardDoc | null> {
  const uid = getSignedInUid();
  if (!uid) return null;
  const code = scanCode.trim().toUpperCase();
  if (!code) return null;
  const store = await readStoreForUid(uid);
  if (!store.card || store.card.scanCode !== code || store.card.ownerUid !== uid) {
    return null;
  }
  return store.card;
}

export async function loadMedicalCardByOwnerUid(
  ownerUid: string,
): Promise<MedicalCardDoc | null> {
  if (!ownerUid) return null;
  // Only the signed-in session may read its own scoped bucket.
  const uid = getSignedInUid();
  if (!uid || uid !== ownerUid) return null;
  const store = await readStoreForUid(ownerUid);
  if (!store.card || store.card.ownerUid !== ownerUid) return null;
  return store.card;
}

/** Drop the signed-in owner's fiche when its scanCode was rotated away. */
export async function removeMedicalCardByScanCode(scanCode: string): Promise<void> {
  const uid = getSignedInUid();
  if (!uid) return;
  const code = scanCode.trim().toUpperCase();
  if (!code) return;
  const store = await readStoreForUid(uid);
  if (!store.card || store.card.scanCode !== code) return;
  await writeStoreForUid(uid, emptyStore());
}

/** Clear medical PHI for the current session (call on sign-out). */
export async function clearMedicalLocalStore(uid?: string | null): Promise<void> {
  const target = uid ?? getSignedInUid();
  if (target) {
    await AsyncStorage.removeItem(medicalLocalKeyForUid(target));
  }
  await AsyncStorage.removeItem(MEDICAL_LOCAL_KEY_LEGACY);
}
