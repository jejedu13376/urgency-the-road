/**
 * Free geocoding via Open-Meteo (no API key) — Module 7 destination resolve.
 * Photon (Komoot) as fallback when Open-Meteo returns empty / network fails.
 */

export type GeocodeHit = {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  admin1?: string;
  label: string;
};

export type GeocodeResult = {
  ok: boolean;
  hits: GeocodeHit[];
  error?: string;
  source: 'open-meteo' | 'photon' | 'none';
};

const UA = 'UrgencyRoad/1.0 (https://github.com/jejedu13376/urgency-the-road)';
const cache = new Map<string, { at: number; result: GeocodeResult }>();
const TTL_MS = 30 * 60 * 1000;

async function photonGeocode(q: string, limit: number): Promise<GeocodeResult> {
  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 8)));
    url.searchParams.set('lang', 'fr');
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, hits: [], error: `Photon HTTP ${res.status}`, source: 'photon' };
    }
    const body = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: {
          name?: string;
          city?: string;
          state?: string;
          country?: string;
          street?: string;
        };
      }>;
    };
    const hits: GeocodeHit[] = [];
    for (const f of body.features ?? []) {
      const coords = f.geometry?.coordinates;
      const p = f.properties;
      if (!coords || !p) continue;
      const [lon, lat] = coords;
      const name = p.name ?? p.street ?? q;
      const parts = [name, p.city, p.state, p.country].filter(Boolean);
      hits.push({
        name,
        lat,
        lon,
        country: p.country,
        admin1: p.state,
        label: parts.join(', '),
      });
    }
    return {
      ok: hits.length > 0,
      hits,
      error: hits.length ? undefined : 'Aucun résultat Photon',
      source: 'photon',
    };
  } catch (e) {
    return {
      ok: false,
      hits: [],
      error: e instanceof Error ? e.message : 'Photon réseau KO',
      source: 'photon',
    };
  }
}

/**
 * Reverse geocode — Photon only.
 * Open-Meteo has no working `/v1/reverse` (HTTP 404); forward search stays Open-Meteo → Photon.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResult> {
  const key = `rev|${lat.toFixed(4)}|${lon.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.result;

  try {
    const url = new URL('https://photon.komoot.io/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('lang', 'fr');
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (res.ok) {
      const body = (await res.json()) as {
        features?: Array<{
          geometry?: { coordinates?: [number, number] };
          properties?: { name?: string; city?: string; state?: string; country?: string };
        }>;
      };
      const f = body.features?.[0];
      if (f?.geometry?.coordinates) {
        const [lonP, latP] = f.geometry.coordinates;
        const p = f.properties ?? {};
        const name = p.name ?? p.city ?? 'Position';
        const label = [name, p.city, p.state, p.country].filter(Boolean).join(', ');
        const result: GeocodeResult = {
          ok: true,
          hits: [{ name, lat: latP, lon: lonP, country: p.country, admin1: p.state, label }],
          source: 'photon',
        };
        cache.set(key, { at: Date.now(), result });
        return result;
      }
    } else {
      const result: GeocodeResult = {
        ok: false,
        hits: [],
        error: `Photon reverse HTTP ${res.status}`,
        source: 'photon',
      };
      cache.set(key, { at: Date.now(), result });
      return result;
    }
  } catch (e) {
    const result: GeocodeResult = {
      ok: false,
      hits: [],
      error: e instanceof Error ? e.message : 'Photon reverse réseau KO',
      source: 'photon',
    };
    cache.set(key, { at: Date.now(), result });
    return result;
  }

  const result: GeocodeResult = {
    ok: false,
    hits: [],
    error: 'Photon reverse — aucun résultat',
    source: 'photon',
  };
  cache.set(key, { at: Date.now(), result });
  return result;
}

export async function geocodePlace(query: string, limit = 5): Promise<GeocodeResult> {
  const q = query.trim();
  if (!q) {
    return { ok: false, hits: [], error: 'Adresse vide', source: 'none' };
  }
  const key = `${q.toLowerCase()}|${limit}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.result;

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', q);
  url.searchParams.set('count', String(Math.min(Math.max(limit, 1), 8)));
  url.searchParams.set('language', 'fr');
  url.searchParams.set('format', 'json');

  try {
    const res = await fetch(url.toString());
    if (res.ok) {
      const body = (await res.json()) as {
        results?: Array<{
          name?: string;
          latitude?: number;
          longitude?: number;
          country?: string;
          admin1?: string;
        }>;
      };
      const hits: GeocodeHit[] = (body.results ?? [])
        .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
        .map((r) => {
          const name = r.name ?? q;
          const parts = [name, r.admin1, r.country].filter(Boolean);
          return {
            name,
            lat: r.latitude as number,
            lon: r.longitude as number,
            country: r.country,
            admin1: r.admin1,
            label: parts.join(', '),
          };
        });
      if (hits.length) {
        const result: GeocodeResult = {
          ok: true,
          hits,
          source: 'open-meteo',
        };
        cache.set(key, { at: Date.now(), result });
        return result;
      }
    }
  } catch {
    // Photon fallback below
  }

  const photon = await photonGeocode(q, limit);
  cache.set(key, { at: Date.now(), result: photon });
  if (photon.ok) return photon;
  return {
    ok: false,
    hits: [],
    error: photon.error ?? 'Géocode Open-Meteo + Photon KO',
    source: photon.source,
  };
}
