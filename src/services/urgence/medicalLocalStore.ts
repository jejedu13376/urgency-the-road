/**
 * Module 13 — on-device medical QR payload store (AsyncStorage).
 * Enables generate / save / scan without network once the fiche is on the device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MedicalCardDoc } from '../../types/firestore';

export const MEDICAL_LOCAL_KEY = 'um.urgence.medicalQr.v1';

type LocalMedicalStore = {
  /** scanCode → card */
  byScanCode: Record<string, MedicalCardDoc>;
  /** ownerUid → scanCode (latest personal QR) */
  byOwnerUid: Record<string, string>;
  updatedAt: string;
};

async function readStore(): Promise<LocalMedicalStore> {
  try {
    const raw = await AsyncStorage.getItem(MEDICAL_LOCAL_KEY);
    if (!raw) {
      return { byScanCode: {}, byOwnerUid: {}, updatedAt: new Date().toISOString() };
    }
    const parsed = JSON.parse(raw) as LocalMedicalStore;
    return {
      byScanCode: parsed.byScanCode ?? {},
      byOwnerUid: parsed.byOwnerUid ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return { byScanCode: {}, byOwnerUid: {}, updatedAt: new Date().toISOString() };
  }
}

async function writeStore(store: LocalMedicalStore): Promise<void> {
  await AsyncStorage.setItem(
    MEDICAL_LOCAL_KEY,
    JSON.stringify({ ...store, updatedAt: new Date().toISOString() }),
  );
}

export async function saveMedicalCardLocal(card: MedicalCardDoc): Promise<MedicalCardDoc> {
  const code = card.scanCode.trim().toUpperCase();
  if (!code.startsWith('UM-QR-')) {
    return card;
  }
  const normalized: MedicalCardDoc = {
    ...card,
    scanCode: code,
    allergies: card.allergies ?? [],
    conditions: card.conditions ?? [],
    medications: card.medications ?? [],
    emergencyContacts: card.emergencyContacts ?? [],
    updatedAt: card.updatedAt || new Date().toISOString(),
  };
  const store = await readStore();
  store.byScanCode[code] = normalized;
  if (normalized.ownerUid) {
    store.byOwnerUid[normalized.ownerUid] = code;
  }
  await writeStore(store);
  return normalized;
}

export async function loadMedicalCardByScanCode(
  scanCode: string,
): Promise<MedicalCardDoc | null> {
  const code = scanCode.trim().toUpperCase();
  if (!code) return null;
  const store = await readStore();
  return store.byScanCode[code] ?? null;
}

export async function loadMedicalCardByOwnerUid(
  ownerUid: string,
): Promise<MedicalCardDoc | null> {
  if (!ownerUid) return null;
  const store = await readStore();
  const code = store.byOwnerUid[ownerUid];
  if (!code) return null;
  return store.byScanCode[code] ?? null;
}

/** Test / reset helper — clears on-device medical QR cache. */
export async function clearMedicalLocalStore(): Promise<void> {
  await AsyncStorage.removeItem(MEDICAL_LOCAL_KEY);
}
