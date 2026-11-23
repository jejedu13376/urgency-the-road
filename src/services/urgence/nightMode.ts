/**
 * Night mode — dark/dim chrome: auto (clock) + manual override.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NightModeSetting = 'auto' | 'on' | 'off';

export const NIGHT_MODE_KEY = 'um.urgence.nightMode.v1';

/** Auto night window (local device clock). */
export const NIGHT_AUTO_START_HOUR = 19;
export const NIGHT_AUTO_END_HOUR = 6;

export function isAutoNightHour(hour: number): boolean {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  return h >= NIGHT_AUTO_START_HOUR || h < NIGHT_AUTO_END_HOUR;
}

export function resolveNightActive(opts: {
  setting: NightModeSetting;
  /** Local hour 0–23. */
  hour: number;
}): boolean {
  if (opts.setting === 'on') return true;
  if (opts.setting === 'off') return false;
  return isAutoNightHour(opts.hour);
}

export async function loadNightModeSetting(): Promise<NightModeSetting> {
  try {
    const raw = await AsyncStorage.getItem(NIGHT_MODE_KEY);
    if (raw === 'auto' || raw === 'on' || raw === 'off') return raw;
    return 'auto';
  } catch {
    return 'auto';
  }
}

export async function saveNightModeSetting(setting: NightModeSetting): Promise<void> {
  await AsyncStorage.setItem(NIGHT_MODE_KEY, setting);
}

export const nightPalette = {
  paper: '#12151A',
  mist: '#1B2129',
  ink: '#E8EEF2',
  slate: '#B7C0CA',
  muted: '#8A949E',
  line: '#2A323C',
  asphalt: '#0B0E12',
  dimOverlay: 'rgba(0,0,0,0.28)',
} as const;
