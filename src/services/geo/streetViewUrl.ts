/**
 * Google Street View Static API / embed helpers.
 * Prefer EXPO_PUBLIC_GOOGLE_MAPS_API_KEY; fall back to Places key when Maps unset.
 * Enable Street View Static API on the key in Google Cloud Console.
 */

function mapsKey(): string {
  const maps = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();
  if (maps) return maps;
  return (process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '').trim();
}

export function isStreetViewConfigured(): boolean {
  return mapsKey().length > 0;
}

export function streetViewStaticUrl(
  lat: number,
  lon: number,
  opts?: { size?: string; heading?: number; pitch?: number; fov?: number },
): string | null {
  const key = mapsKey();
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const size = opts?.size ?? '640x420';
  const heading = opts?.heading ?? 0;
  const pitch = opts?.pitch ?? 0;
  const fov = opts?.fov ?? 90;
  return (
    `https://maps.googleapis.com/maps/api/streetview?size=${encodeURIComponent(size)}` +
    `&location=${encodeURIComponent(`${lat},${lon}`)}` +
    `&heading=${heading}&pitch=${pitch}&fov=${fov}` +
    `&key=${encodeURIComponent(key)}`
  );
}

/** Browser / WebView embed (pano) — works when Maps Embed / JS API allowed on key. */
export function streetViewEmbedUrl(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const key = mapsKey();
  if (!key) {
    // Keyless OSM fallback peek — not Street View, but honest soft fallback.
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
  }
  return (
    `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(key)}` +
    `&location=${encodeURIComponent(`${lat},${lon}`)}&heading=0&pitch=0&fov=90`
  );
}
