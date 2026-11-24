/**
 * Live weather via Open-Meteo (free, no API key) — Module 13 bandeau + M7 dest + route rain/snow.
 * Cached ~10 min per lat/lon cell to cut latency / egress.
 */

export type WeatherPrecipKind = 'none' | 'rain' | 'snow' | 'mixed' | 'ice' | 'storm';

export type WeatherSnapshot = {
  tempC: number;
  /** WMO weather code from Open-Meteo current conditions. */
  weatherCode: number;
  precipKind: WeatherPrecipKind;
  road: 'ouvertes' | 'fermees' | 'glacees';
  updatedAt: string;
  source: 'open-meteo' | 'fallback';
  label: string;
};

export type RouteWeatherSample = {
  lat: number;
  lon: number;
  /** Approx km from route start (polyline index spacing). */
  distanceKm: number;
  weather: WeatherSnapshot;
};

export type RouteWeatherBrief = {
  samples: RouteWeatherSample[];
  /** Worst precip along sampled points (storm > ice > snow > mixed > rain > none). */
  worstPrecip: WeatherPrecipKind;
  hasRain: boolean;
  hasSnow: boolean;
  label: string;
};

type Cache = { at: number; data: WeatherSnapshot };
const cache = new Map<string, Cache>();
const TTL_MS = 10 * 60 * 1000;

/** Default Lille HQ if no GPS yet — still live network data. */
const DEFAULT_LAT = 50.6292;
const DEFAULT_LON = 3.0573;

const PRECIP_RANK: Record<WeatherPrecipKind, number> = {
  none: 0,
  rain: 1,
  mixed: 2,
  snow: 3,
  ice: 4,
  storm: 5,
};

function cellKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/** Map WMO weather codes → precip kind for trucker rain/snow alerts. */
export function precipKindFromWmo(code: number): WeatherPrecipKind {
  if (code >= 95) return 'storm';
  if (code === 66 || code === 67) return 'ice';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  // Freezing drizzle / mixed rain+snow showers
  if (code === 56 || code === 57 || code === 68 || code === 69) return 'mixed';
  // Drizzle / rain / rain showers
  if (
    (code >= 51 && code <= 55) ||
    (code >= 61 && code <= 65) ||
    (code >= 80 && code <= 82)
  ) {
    return 'rain';
  }
  return 'none';
}

export function roadFromPrecip(kind: WeatherPrecipKind): WeatherSnapshot['road'] {
  if (kind === 'ice' || kind === 'snow') return 'glacees';
  if (kind === 'storm') return 'fermees';
  return 'ouvertes';
}

export function worsePrecip(a: WeatherPrecipKind, b: WeatherPrecipKind): WeatherPrecipKind {
  return PRECIP_RANK[a] >= PRECIP_RANK[b] ? a : b;
}

/**
 * Evenly sample up to `max` points along a [lat, lon] polyline (keep ends).
 * Dedupes adjacent cells so Open-Meteo cache hits stay high.
 */
export function sampleRouteWeatherPoints(
  coords: [number, number][],
  max = 6,
): { lat: number; lon: number; distanceKm: number }[] {
  if (!coords.length) return [];
  const capped = Math.max(1, Math.min(max, 8));
  if (coords.length === 1) {
    return [{ lat: coords[0][0], lon: coords[0][1], distanceKm: 0 }];
  }
  const last = coords.length - 1;
  const out: { lat: number; lon: number; distanceKm: number }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < capped; i += 1) {
    const idx = Math.round((i / (capped - 1)) * last);
    const [lat, lon] = coords[idx];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const key = cellKey(lat, lon);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      lat,
      lon,
      distanceKm: Math.round((idx / last) * 1000) / 10, // relative index → approx % * 100 for label; refined below
    });
  }
  // Recompute distanceKm as cumulative haversine fraction of total route length.
  let total = 0;
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i += 1) {
    total += haversineKmSimple(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    cum.push(total);
  }
  return out.map((p) => {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < coords.length; i += 1) {
      const d =
        Math.abs(coords[i][0] - p.lat) + Math.abs(coords[i][1] - p.lon);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    return {
      ...p,
      distanceKm: Math.round((cum[bestIdx] ?? 0) * 10) / 10,
    };
  });
}

function haversineKmSimple(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function snapshotFromCode(tempC: number, code: number, source: WeatherSnapshot['source'], label: string): WeatherSnapshot {
  const precipKind = precipKindFromWmo(code);
  return {
    tempC,
    weatherCode: code,
    precipKind,
    road: roadFromPrecip(precipKind),
    updatedAt: new Date().toISOString(),
    source,
    label,
  };
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
    const data = snapshotFromCode(tempC, code, 'open-meteo', 'Météo LIVE Open-Meteo');
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return snapshotFromCode(8, 0, 'fallback', 'Météo fallback locale (réseau KO)');
  }
}

/**
 * Sample weather along a route polyline (rain / snow / ice / storm).
 * Caps concurrent Open-Meteo calls via cell cache + max samples.
 */
export async function fetchWeatherAlongRoute(
  coords: [number, number][],
  opts?: { maxSamples?: number; fetchOne?: typeof fetchWeather },
): Promise<RouteWeatherBrief> {
  const fetchOne = opts?.fetchOne ?? fetchWeather;
  const points = sampleRouteWeatherPoints(coords, opts?.maxSamples ?? 6);
  if (!points.length) {
    return {
      samples: [],
      worstPrecip: 'none',
      hasRain: false,
      hasSnow: false,
      label: 'Météo trajet — pas de polyline',
    };
  }

  const samples: RouteWeatherSample[] = [];
  let worst: WeatherPrecipKind = 'none';
  for (const p of points) {
    const weather = await fetchOne(p.lat, p.lon).catch(() =>
      snapshotFromCode(8, 0, 'fallback', 'Météo fallback'),
    );
    samples.push({ ...p, weather });
    worst = worsePrecip(worst, weather.precipKind);
  }

  const hasRain = samples.some(
    (s) => s.weather.precipKind === 'rain' || s.weather.precipKind === 'mixed',
  );
  const hasSnow = samples.some(
    (s) =>
      s.weather.precipKind === 'snow' ||
      s.weather.precipKind === 'ice' ||
      s.weather.precipKind === 'mixed',
  );

  const bits: string[] = [];
  if (hasSnow) bits.push('neige');
  if (hasRain) bits.push('pluie');
  if (worst === 'storm') bits.push('orage');
  const label =
    bits.length > 0
      ? `Météo trajet · ${bits.join(' + ')} (${samples.length} pts Open-Meteo)`
      : `Météo trajet OK · ${samples.length} pts · pas de pluie/neige`;

  return { samples, worstPrecip: worst, hasRain, hasSnow, label };
}
