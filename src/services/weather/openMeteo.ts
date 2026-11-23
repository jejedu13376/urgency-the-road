/**
 * Live weather via Open-Meteo (free, no API key) — Module 13 bandeau + M7 dest.
 * Cached ~10 min per lat/lon cell to cut latency / egress.
 */

export type WeatherSnapshot = {
  tempC: number;
  road: 'ouvertes' | 'fermees' | 'glacees';
  updatedAt: string;
  source: 'open-meteo' | 'fallback';
  label: string;
};

type Cache = { at: number; data: WeatherSnapshot };
const cache = new Map<string, Cache>();
const TTL_MS = 10 * 60 * 1000;

/** Default Lille HQ if no GPS yet — still live network data. */
const DEFAULT_LAT = 50.6292;
const DEFAULT_LON = 3.0573;

function cellKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export async function fetchWeather(lat?: number, lon?: number): Promise<WeatherSnapshot> {
  const latitude = lat ?? DEFAULT_LAT;
  const longitude = lon ?? DEFAULT_LON;
  const key = cellKey(latitude, longitude);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('timezone', 'auto');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const body = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const tempC = Math.round(body.current?.temperature_2m ?? 8);
    const code = body.current?.weather_code ?? 0;
    // WMO: 66/67 freezing rain, 71–77 snow, 85–86 snow showers → glacées
    const road: WeatherSnapshot['road'] =
      code === 66 || code === 67 || (code >= 71 && code <= 77) || code === 85 || code === 86
        ? 'glacees'
        : code >= 95
          ? 'fermees'
          : 'ouvertes';
    const data: WeatherSnapshot = {
      tempC,
      road,
      updatedAt: new Date().toISOString(),
      source: 'open-meteo',
      label: 'Météo LIVE Open-Meteo',
    };
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    const data: WeatherSnapshot = {
      tempC: 8,
      road: 'ouvertes',
      updatedAt: new Date().toISOString(),
      source: 'fallback',
      label: 'Météo fallback locale (réseau KO)',
    };
    return data;
  }
}
