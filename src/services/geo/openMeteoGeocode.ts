/**
 * Free geocoding via Open-Meteo (no API key) — Module 7 destination resolve.
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
  source: 'open-meteo' | 'none';
};

const cache = new Map<string, { at: number; result: GeocodeResult }>();
const TTL_MS = 30 * 60 * 1000;

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
    if (!res.ok) {
      return { ok: false, hits: [], error: `Géocode HTTP ${res.status}`, source: 'open-meteo' };
    }
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
    const result: GeocodeResult = {
      ok: hits.length > 0,
      hits,
      error: hits.length ? undefined : 'Aucun résultat Open-Meteo',
      source: 'open-meteo',
    };
    cache.set(key, { at: Date.now(), result });
    return result;
  } catch (e) {
    return {
      ok: false,
      hits: [],
      error: e instanceof Error ? e.message : 'Géocode réseau KO',
      source: 'open-meteo',
    };
  }
}
