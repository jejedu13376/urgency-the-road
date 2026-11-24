/**
 * OpenWeather Air Pollution API (free tier) — current AQI near a point.
 * Key: EXPO_PUBLIC_OPENWEATHER_API_KEY
 * Docs: https://openweathermap.org/api/air-pollution
 */
const UA = 'UrgencyRoad/1.0 (https://github.com/jejedu13376/urgency-the-road)';

export type AqiSample = {
  lat: number;
  lon: number;
  /** OpenWeather 1–5 scale (1=Good … 5=Very Poor). */
  aqi: number;
  label: string;
  pm25?: number;
  pm10?: number;
};

export type AqiFetchResult = {
  ok: boolean;
  samples: AqiSample[];
  source: 'openweather' | 'none';
  label: string;
  error?: string;
};

function getApiKey(): string {
  return (process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY ?? '').trim();
}

export function isOpenWeatherAqiConfigured(): boolean {
  return getApiKey().length > 0;
}

const AQI_LABELS_FR = ['', 'Bon', 'Correct', 'Moyen', 'Mauvais', 'Très mauvais'] as const;

function aqiLabel(aqi: number): string {
  const n = Math.round(aqi);
  if (n >= 1 && n <= 5) return AQI_LABELS_FR[n];
  return `AQI ${aqi}`;
}

async function fetchOne(lat: number, lon: number, key: string): Promise<AqiSample | null> {
  const url =
    `https://api.openweathermap.org/data/2.5/air_pollution?lat=${encodeURIComponent(String(lat))}` +
    `&lon=${encodeURIComponent(String(lon))}&appid=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    list?: { main?: { aqi?: number }; components?: { pm2_5?: number; pm10?: number } }[];
  };
  const row = body.list?.[0];
  const aqi = row?.main?.aqi;
  if (typeof aqi !== 'number' || !Number.isFinite(aqi)) return null;
  return {
    lat,
    lon,
    aqi,
    label: aqiLabel(aqi),
    pm25: row?.components?.pm2_5,
    pm10: row?.components?.pm10,
  };
}

/**
 * Sample current + a small ring around the point for a coarse overlay.
 * Soft-fails when key missing or network KO.
 */
export async function fetchAirQualityNear(
  lat: number,
  lon: number,
  opts?: { ringKm?: number },
): Promise<AqiFetchResult> {
  const key = getApiKey();
  if (!key) {
    return {
      ok: false,
      samples: [],
      source: 'none',
      label: 'AQI — EXPO_PUBLIC_OPENWEATHER_API_KEY manquant',
      error: 'missing_key',
    };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      ok: false,
      samples: [],
      source: 'none',
      label: 'AQI — coords invalides',
      error: 'bad_coords',
    };
  }

  const ringKm = Math.min(Math.max(opts?.ringKm ?? 8, 2), 25);
  // ~1° lat ≈ 111 km; lon scales with cos(lat)
  const dLat = ringKm / 111;
  const cos = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const dLon = ringKm / (111 * cos);
  const points: { lat: number; lon: number }[] = [
    { lat, lon },
    { lat: lat + dLat, lon },
    { lat: lat - dLat, lon },
    { lat, lon: lon + dLon },
    { lat, lon: lon - dLon },
  ];

  try {
    const settled = await Promise.all(
      points.map((p) => fetchOne(p.lat, p.lon, key).catch(() => null)),
    );
    const samples = settled.filter((s): s is AqiSample => !!s);
    if (!samples.length) {
      return {
        ok: false,
        samples: [],
        source: 'openweather',
        label: 'AQI OpenWeather vide / HTTP KO',
        error: 'empty',
      };
    }
    const center = samples[0];
    return {
      ok: true,
      samples,
      source: 'openweather',
      label: `AQI ${center.aqi} · ${center.label} · OpenWeather`,
    };
  } catch (e) {
    return {
      ok: false,
      samples: [],
      source: 'none',
      label: 'AQI réseau KO',
      error: e instanceof Error ? e.message : 'network',
    };
  }
}

/** Leaflet circle fill color for OWM 1–5 AQI. */
export function aqiFillColor(aqi: number): string {
  const n = Math.round(aqi);
  switch (n) {
    case 1:
      return '#2ECC71';
    case 2:
      return '#F1C40F';
    case 3:
      return '#E67E22';
    case 4:
      return '#E74C3C';
    case 5:
      return '#8E44AD';
    default:
      return '#7F8C8D';
  }
}
