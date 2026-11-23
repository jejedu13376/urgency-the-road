/**
 * Persist explicit language choice (AsyncStorage).
 * Missing key → resolve from device locale (see resolveDeviceLocale).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAppLocale, type AppLocale } from './types';

export const LOCALE_STORAGE_KEY = 'um.locale.v1';

export async function loadStoredLocale(): Promise<AppLocale | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { locale?: unknown };
    return isAppLocale(parsed.locale) ? parsed.locale : null;
  } catch {
    return null;
  }
}

export async function saveStoredLocale(locale: AppLocale): Promise<void> {
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify({ locale }));
}
