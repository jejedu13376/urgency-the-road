/**
 * GPS navigation prefs — AsyncStorage (always) + optional Firestore sync when signed in.
 * Mode voiture/camion drives Valhalla costing and map HUD.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GpsVehicleMode = 'voiture' | 'camion';

export type GpsNavPrefs = {
  mode: GpsVehicleMode;
  truckHeightM: number;
  truckWidthM: number;
  truckPtacT: number;
  /** Overall combo length (m) — from trucker profile when set. */
  truckLengthM: number;
  axleCount: number;
  hazmat: boolean;
  updatedAt: string;
};

export const GPS_NAV_PREFS_KEY = 'um.gps.nav.prefs.v1';

export const DEFAULT_GPS_NAV_PREFS: GpsNavPrefs = {
  mode: 'voiture',
  truckHeightM: 4.0,
  truckWidthM: 2.55,
  truckPtacT: 40,
  truckLengthM: 16.5,
  axleCount: 5,
  hazmat: false,
  updatedAt: new Date(0).toISOString(),
};

export async function loadGpsNavPrefs(): Promise<GpsNavPrefs> {
  try {
    const raw = await AsyncStorage.getItem(GPS_NAV_PREFS_KEY);
    if (!raw) return { ...DEFAULT_GPS_NAV_PREFS };
    const parsed = JSON.parse(raw) as Partial<GpsNavPrefs>;
    return {
      mode: parsed.mode === 'camion' ? 'camion' : 'voiture',
      truckHeightM: Number(parsed.truckHeightM) || DEFAULT_GPS_NAV_PREFS.truckHeightM,
      truckWidthM: Number(parsed.truckWidthM) || DEFAULT_GPS_NAV_PREFS.truckWidthM,
      truckPtacT: Number(parsed.truckPtacT) || DEFAULT_GPS_NAV_PREFS.truckPtacT,
      truckLengthM: Number(parsed.truckLengthM) || DEFAULT_GPS_NAV_PREFS.truckLengthM,
      axleCount: Math.round(Number(parsed.axleCount) || DEFAULT_GPS_NAV_PREFS.axleCount),
      hazmat: Boolean(parsed.hazmat),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return { ...DEFAULT_GPS_NAV_PREFS };
  }
}

export async function saveGpsNavPrefs(patch: Partial<GpsNavPrefs>): Promise<GpsNavPrefs> {
  const prev = await loadGpsNavPrefs();
  const next: GpsNavPrefs = {
    ...prev,
    ...patch,
    mode: patch.mode === 'camion' || patch.mode === 'voiture' ? patch.mode : prev.mode,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(GPS_NAV_PREFS_KEY, JSON.stringify(next));
  return next;
}
