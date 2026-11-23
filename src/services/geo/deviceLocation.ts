/**
 * Device GPS via expo-location (free, no API key).
 * Honest failures when permission denied / unavailable — never invents a "success" fix.
 */
import * as Location from 'expo-location';

export type DeviceCoords = {
  lat: number;
  lon: number;
  accuracyM: number | null;
  source: 'device' | 'fallback';
  label: string;
};

/** Lille HQ fallback when GPS unavailable — same as Open-Meteo default. */
export const FALLBACK_LAT = 50.6292;
export const FALLBACK_LON = 3.0573;

export async function getDeviceCoords(opts?: {
  /** If true, return fallback coords instead of failing when GPS unavailable. */
  allowFallback?: boolean;
}): Promise<{ ok: true; data: DeviceCoords } | { ok: false; error: string; data?: DeviceCoords }> {
  const allowFallback = opts?.allowFallback ?? true;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      const msg = 'Permission localisation refusée';
      if (!allowFallback) return { ok: false, error: msg };
      return {
        ok: false,
        error: msg,
        data: {
          lat: FALLBACK_LAT,
          lon: FALLBACK_LON,
          accuracyM: null,
          source: 'fallback',
          label: 'GPS fallback Lille (permission refusée)',
        },
      };
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      ok: true,
      data: {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracyM: pos.coords.accuracy ?? null,
        source: 'device',
        label: 'GPS appareil LIVE',
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'GPS indisponible';
    if (!allowFallback) return { ok: false, error: msg };
    return {
      ok: false,
      error: msg,
      data: {
        lat: FALLBACK_LAT,
        lon: FALLBACK_LON,
        accuracyM: null,
        source: 'fallback',
        label: `GPS fallback Lille (${msg})`,
      },
    };
  }
}

export type LivePosition = {
  lat: number;
  lon: number;
  accuracyM: number | null;
  headingDeg: number | null;
  speedMps: number | null;
  at: number;
};

export type PositionSubscription = { remove: () => void };

/**
 * Continuous foreground GPS for the Carte vehicle marker.
 * Caller must remove() on blur/unmount — never remount the map on each tick.
 */
export async function watchDevicePosition(
  onUpdate: (pos: LivePosition) => void,
  onError?: (message: string) => void,
): Promise<PositionSubscription | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      onError?.('Permission localisation refusée');
      return null;
    }
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 3,
        mayShowUserSettingsDialog: true,
      },
      (pos) => {
        const heading = pos.coords.heading;
        const speed = pos.coords.speed;
        onUpdate({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? null,
          headingDeg:
            typeof heading === 'number' && Number.isFinite(heading) && heading >= 0
              ? heading
              : null,
          speedMps: typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? speed : null,
          at: pos.timestamp ?? Date.now(),
        });
      },
    );
    return sub;
  } catch (e) {
    onError?.(e instanceof Error ? e.message : 'GPS watch indisponible');
    return null;
  }
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function etaMinutesFromKm(km: number): number {
  // Rough urban average ~30 km/h
  return Math.max(3, Math.round((km / 30) * 60));
}
