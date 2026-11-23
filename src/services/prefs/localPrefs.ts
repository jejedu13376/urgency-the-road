/**
 * Hub Paramètres — local prefs shared with AppShell chrome (WeatherBanner).
 * AsyncStorage only — no remote push / no paid APIs.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PARAMETRES_PREFS_KEY = 'um.parametres.prefs.v1';
export const PARAMETRES_NOTIF_KEY = 'um.parametres.notif.v1';

export type LocalPrefs = {
  metricUnits: boolean;
  /** Stored only — theme chrome not wired yet (honest stub). */
  darkChrome: boolean;
  showWeather: boolean;
};

export type LocalNotifs = {
  entretien: boolean;
  sos: boolean;
  fil: boolean;
  marketing: boolean;
};

export const DEFAULT_LOCAL_PREFS: LocalPrefs = {
  metricUnits: true,
  darkChrome: false,
  showWeather: true,
};

export const DEFAULT_LOCAL_NOTIFS: LocalNotifs = {
  entretien: true,
  sos: true,
  fil: false,
  marketing: false,
};

export async function loadLocalPrefs(): Promise<LocalPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PARAMETRES_PREFS_KEY);
    if (!raw) return { ...DEFAULT_LOCAL_PREFS };
    return { ...DEFAULT_LOCAL_PREFS, ...(JSON.parse(raw) as LocalPrefs) };
  } catch {
    return { ...DEFAULT_LOCAL_PREFS };
  }
}

export async function saveLocalPrefs(prefs: LocalPrefs): Promise<void> {
  await AsyncStorage.setItem(PARAMETRES_PREFS_KEY, JSON.stringify(prefs));
}

export async function loadLocalNotifs(): Promise<LocalNotifs> {
  try {
    const raw = await AsyncStorage.getItem(PARAMETRES_NOTIF_KEY);
    if (!raw) return { ...DEFAULT_LOCAL_NOTIFS };
    return { ...DEFAULT_LOCAL_NOTIFS, ...(JSON.parse(raw) as LocalNotifs) };
  } catch {
    return { ...DEFAULT_LOCAL_NOTIFS };
  }
}

export async function saveLocalNotifs(notifs: LocalNotifs): Promise<void> {
  await AsyncStorage.setItem(PARAMETRES_NOTIF_KEY, JSON.stringify(notifs));
}
