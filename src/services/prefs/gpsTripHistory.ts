/**
 * GPS trip history — AsyncStorage only.
 * Recorded when navigation starts; timeline UI can reopen routes on the map.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GpsVehicleMode } from './gpsNavPrefs';

export const GPS_TRIP_HISTORY_KEY = 'um.gps.trip.history.v1';
const MAX_TRIPS = 80;
/** Cap stored polyline points to keep AsyncStorage small. */
const MAX_COORDS = 400;

export type GpsTripRecord = {
  id: string;
  startedAt: string;
  /** ISO end time when trip completed / arrived; may equal startedAt if still open. */
  endedAt?: string;
  mode: GpsVehicleMode;
  origin: { lat: number; lon: number; label?: string };
  destination: { lat: number; lon: number; label?: string };
  distanceKm: number;
  durationMin: number;
  /** Downsampled [lat, lon] route for map replay. */
  coords: [number, number][];
};

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function sanitizeCoords(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return [];
  const out: [number, number][] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const lat = row[0];
    const lon = row[1];
    if (!isFiniteCoord(lat) || !isFiniteCoord(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    out.push([lat, lon]);
    if (out.length >= MAX_COORDS) break;
  }
  return out;
}

/** Evenly downsample a polyline to at most `max` points (keep ends). */
export function downsampleCoords(
  coords: [number, number][],
  max = MAX_COORDS,
): [number, number][] {
  if (coords.length <= max) return coords.slice();
  if (max < 2) return coords.slice(0, max);
  const out: [number, number][] = [];
  const last = coords.length - 1;
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i / (max - 1)) * last);
    out.push(coords[idx]);
  }
  return out;
}

function sanitizeTrip(raw: unknown): GpsTripRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const origin = t.origin as Record<string, unknown> | undefined;
  const destination = t.destination as Record<string, unknown> | undefined;
  if (!origin || !destination) return null;
  if (!isFiniteCoord(origin.lat) || !isFiniteCoord(origin.lon)) return null;
  if (!isFiniteCoord(destination.lat) || !isFiniteCoord(destination.lon)) return null;
  const mode = t.mode === 'camion' ? 'camion' : t.mode === 'voiture' ? 'voiture' : null;
  if (!mode) return null;
  const startedAt = typeof t.startedAt === 'string' ? t.startedAt : null;
  if (!startedAt) return null;
  const id =
    typeof t.id === 'string' && t.id
      ? t.id
      : `trip-${startedAt}-${origin.lat.toFixed(4)}-${destination.lat.toFixed(4)}`;
  const distanceKm =
    typeof t.distanceKm === 'number' && Number.isFinite(t.distanceKm)
      ? Math.max(0, Math.round(t.distanceKm * 10) / 10)
      : 0;
  const durationMin =
    typeof t.durationMin === 'number' && Number.isFinite(t.durationMin)
      ? Math.max(0, Math.round(t.durationMin))
      : 0;
  return {
    id,
    startedAt,
    endedAt: typeof t.endedAt === 'string' ? t.endedAt : undefined,
    mode,
    origin: {
      lat: origin.lat,
      lon: origin.lon,
      label:
        typeof origin.label === 'string' ? origin.label.trim().slice(0, 120) || undefined : undefined,
    },
    destination: {
      lat: destination.lat,
      lon: destination.lon,
      label:
        typeof destination.label === 'string'
          ? destination.label.trim().slice(0, 120) || undefined
          : undefined,
    },
    distanceKm,
    durationMin,
    coords: sanitizeCoords(t.coords),
  };
}

export async function loadTripHistory(): Promise<GpsTripRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(GPS_TRIP_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeTrip)
      .filter((t): t is GpsTripRecord => !!t)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .slice(0, MAX_TRIPS);
  } catch {
    return [];
  }
}

export async function recordTripStart(input: {
  mode: GpsVehicleMode;
  origin: { lat: number; lon: number; label?: string };
  destination: { lat: number; lon: number; label?: string };
  distanceKm: number;
  durationMin: number;
  coords: [number, number][];
}): Promise<{ ok: true; trip: GpsTripRecord } | { ok: false; error: string }> {
  if (!isFiniteCoord(input.origin.lat) || !isFiniteCoord(input.origin.lon)) {
    return { ok: false, error: 'Origine invalide' };
  }
  if (!isFiniteCoord(input.destination.lat) || !isFiniteCoord(input.destination.lon)) {
    return { ok: false, error: 'Destination invalide' };
  }
  const startedAt = new Date().toISOString();
  const trip: GpsTripRecord = {
    id: `trip-${startedAt}`,
    startedAt,
    mode: input.mode === 'camion' ? 'camion' : 'voiture',
    origin: {
      lat: input.origin.lat,
      lon: input.origin.lon,
      label: input.origin.label?.trim().slice(0, 120) || undefined,
    },
    destination: {
      lat: input.destination.lat,
      lon: input.destination.lon,
      label: input.destination.label?.trim().slice(0, 120) || undefined,
    },
    distanceKm: Math.max(0, Math.round(input.distanceKm * 10) / 10),
    durationMin: Math.max(0, Math.round(input.durationMin)),
    coords: downsampleCoords(input.coords),
  };
  try {
    const prev = await loadTripHistory();
    const next = [trip, ...prev.filter((t) => t.id !== trip.id)].slice(0, MAX_TRIPS);
    await AsyncStorage.setItem(GPS_TRIP_HISTORY_KEY, JSON.stringify(next));
    return { ok: true, trip };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Historique KO' };
  }
}

export async function completeTrip(
  tripId: string,
): Promise<{ ok: true; trip: GpsTripRecord } | { ok: false; error: string }> {
  try {
    const prev = await loadTripHistory();
    const idx = prev.findIndex((t) => t.id === tripId);
    if (idx < 0) return { ok: false, error: 'Trajet introuvable' };
    const trip: GpsTripRecord = {
      ...prev[idx],
      endedAt: new Date().toISOString(),
    };
    const next = [...prev];
    next[idx] = trip;
    await AsyncStorage.setItem(GPS_TRIP_HISTORY_KEY, JSON.stringify(next));
    return { ok: true, trip };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Fin trajet KO' };
  }
}

export function formatTripWhen(iso: string, locale = 'fr-CA'): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatTripSummaryLine(trip: GpsTripRecord): string {
  const from = trip.origin.label ?? `${trip.origin.lat.toFixed(3)}, ${trip.origin.lon.toFixed(3)}`;
  const to =
    trip.destination.label ??
    `${trip.destination.lat.toFixed(3)}, ${trip.destination.lon.toFixed(3)}`;
  return `${from} → ${to} · ${trip.distanceKm} km · ~${trip.durationMin} min`;
}
