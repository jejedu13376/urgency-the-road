/**
 * Module 10 — persist carnet entries + maintenance status locally.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CarnetExportLine } from './exportCarnet';
import type { MaintenanceItem } from '../../types/modules';

const KEY = 'um.carnet.v1';

export type StoredCarnet = {
  vehicleKey: string;
  entries: CarnetExportLine[];
  maintenance: MaintenanceItem[];
  updatedAt: string;
};

function storageKey(vehicleKey: string) {
  return `${KEY}:${vehicleKey || 'default'}`;
}

export async function loadCarnet(vehicleKey: string): Promise<StoredCarnet | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(vehicleKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCarnet;
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCarnet(payload: StoredCarnet): Promise<void> {
  await AsyncStorage.setItem(
    storageKey(payload.vehicleKey),
    JSON.stringify({ ...payload, updatedAt: new Date().toISOString() }),
  );
}
