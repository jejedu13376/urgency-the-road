/**
 * Module 17 — local Super-admin / Pro atelier persistence (AsyncStorage).
 * Honest offline KPI shell — not a cloud analytics backend.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const FLAGS_KEY = 'um.admin.flags.v1';
const MOD_KEY = 'um.admin.mod.v1';
const ACCOUNTS_KEY = 'um.admin.accounts.v1';
const RATINGS_KEY = 'um.pro.ratings.v1';
const KPI_KEY = 'um.pro.kpi.v1';

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export const adminKeys = {
  flags: FLAGS_KEY,
  mod: MOD_KEY,
  accounts: ACCOUNTS_KEY,
  ratings: RATINGS_KEY,
  kpi: KPI_KEY,
};

export type LocalProKpi = {
  updatedAt: string;
  charge: number;
  inShop: number;
  ca: number;
  currency: string;
  ratingsCount: number;
};

export async function loadProKpi(): Promise<LocalProKpi | null> {
  return loadJson<LocalProKpi>(KPI_KEY);
}

export async function saveProKpi(kpi: LocalProKpi): Promise<void> {
  await saveJson(KPI_KEY, kpi);
}
