/**
 * GPS saved places + labels — AsyncStorage only (shared by map destination menu / future Places UI).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GPS_SAVED_PLACES_KEY = 'um.gps.saved.places.v1';

/** Shared destination / place ref — keep coords + display label + optional user tag. */
export type GpsPlaceRef = {
  lat: number;
  lon: number;
  /** Address / place name from geocode or map. */
  label: string;
  /** User étiquette (optional). */
  tag?: string;
  savedAt: string;
  id: string;
};

function placeId(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function sanitizePlace(raw: unknown): GpsPlaceRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (!isFiniteCoord(p.lat) || !isFiniteCoord(p.lon)) return null;
  if (p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180) return null;
  const label = typeof p.label === 'string' ? p.label.trim().slice(0, 160) : '';
  if (!label) return null;
  const tag = typeof p.tag === 'string' ? p.tag.trim().slice(0, 48) : undefined;
  const savedAt = typeof p.savedAt === 'string' ? p.savedAt : new Date().toISOString();
  const id = typeof p.id === 'string' && p.id ? p.id : placeId(p.lat, p.lon);
  return { id, lat: p.lat, lon: p.lon, label, tag: tag || undefined, savedAt };
}

export async function loadSavedPlaces(): Promise<GpsPlaceRef[]> {
  try {
    const raw = await AsyncStorage.getItem(GPS_SAVED_PLACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizePlace).filter((p): p is GpsPlaceRef => !!p).slice(0, 100);
  } catch {
    return [];
  }
}

export async function savePlace(input: {
  lat: number;
  lon: number;
  label: string;
  tag?: string;
}): Promise<{ ok: true; place: GpsPlaceRef } | { ok: false; error: string }> {
  if (!isFiniteCoord(input.lat) || !isFiniteCoord(input.lon)) {
    return { ok: false, error: 'Coordonnées invalides' };
  }
  const label = input.label.trim().slice(0, 160);
  if (!label) return { ok: false, error: 'Libellé requis' };
  const tag = input.tag?.trim().slice(0, 48) || undefined;
  const id = placeId(input.lat, input.lon);
  const place: GpsPlaceRef = {
    id,
    lat: input.lat,
    lon: input.lon,
    label,
    tag,
    savedAt: new Date().toISOString(),
  };
  try {
    const prev = await loadSavedPlaces();
    const next = [place, ...prev.filter((p) => p.id !== id)].slice(0, 100);
    await AsyncStorage.setItem(GPS_SAVED_PLACES_KEY, JSON.stringify(next));
    return { ok: true, place };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Enregistrement KO' };
  }
}

export async function updatePlaceTag(
  lat: number,
  lon: number,
  tag: string,
  fallbackLabel: string,
): Promise<{ ok: true; place: GpsPlaceRef } | { ok: false; error: string }> {
  const trimmed = tag.trim().slice(0, 48);
  const prev = await loadSavedPlaces();
  const id = placeId(lat, lon);
  const existing = prev.find((p) => p.id === id);
  return savePlace({
    lat,
    lon,
    label: existing?.label ?? fallbackLabel,
    tag: trimmed || undefined,
  });
}

export function formatPlaceShareLine(place: Pick<GpsPlaceRef, 'lat' | 'lon' | 'label' | 'tag'>): string {
  const tagBit = place.tag ? ` (${place.tag})` : '';
  return `${place.label}${tagBit}\nhttps://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=16/${place.lat}/${place.lon}`;
}

export function formatMyLocationShareLine(lat: number, lon: number): string {
  return `Ma position — Urgence Mécanique\nhttps://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}
