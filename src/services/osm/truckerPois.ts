/**
 * Overpass fuel + rest areas for trucker nav brief (free OSM, no key).
 */
const UA = 'UrgencyRoad/1.0 (https://github.com/jejedu13376/urgency-the-road)';
const ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

type OsmEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string | undefined>;
};

async function overpassQuery(ql: string): Promise<OsmEl[]> {
  let lastErr = 'Overpass indisponible';
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
          'User-Agent': UA,
        },
        body: `data=${encodeURIComponent(ql)}`,
      });
      if (!res.ok) {
        lastErr = `Overpass HTTP ${res.status}`;
        continue;
      }
      const text = await res.text();
      if (text.trimStart().startsWith('<') || text.trimStart().startsWith('#')) {
        lastErr = `Overpass non-JSON (${endpoint})`;
        continue;
      }
      const body = JSON.parse(text) as { elements?: OsmEl[] };
      return body.elements ?? [];
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'Overpass réseau KO';
    }
  }
  throw new Error(lastErr);
}

function coordsOf(el: OsmEl): { lat: number; lon: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lon: el.lon };
  if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

export type TruckerPoi = { id: string; name: string; lat: number; lon: number };

export async function overpassQueryRestFuel(
  lat: number,
  lon: number,
  radiusM = 35000,
): Promise<{ fuel: TruckerPoi[]; rest: TruckerPoi[]; label: string }> {
  const r = Math.min(Math.max(radiusM, 5000), 80000);
  const ql = `[out:json][timeout:26];
(
  node["amenity"="fuel"](around:${r},${lat},${lon});
  node["amenity"="fuel"]["hgv"="yes"](around:${r},${lat},${lon});
  node["highway"="rest_area"](around:${r},${lat},${lon});
  way["highway"="rest_area"](around:${r},${lat},${lon});
  node["highway"="services"](around:${r},${lat},${lon});
  way["highway"="services"](around:${r},${lat},${lon});
  node["amenity"="truck_stop"](around:${r},${lat},${lon});
);
out center tags 35;`;

  const els = await overpassQuery(ql);
  const fuel: TruckerPoi[] = [];
  const rest: TruckerPoi[] = [];
  for (const el of els) {
    const c = coordsOf(el);
    if (!c) continue;
    const tags = el.tags ?? {};
    const name = tags.name ?? tags.brand ?? tags.operator ?? `POI OSM #${el.id}`;
    const id = `osm-poi-${el.type}-${el.id}`;
    const poi = { id, name: String(name).slice(0, 80), lat: c.lat, lon: c.lon };
    if (tags.amenity === 'fuel' || tags.amenity === 'truck_stop') fuel.push(poi);
    else if (tags.highway === 'rest_area' || tags.highway === 'services') rest.push(poi);
  }
  return {
    fuel: fuel.slice(0, 15),
    rest: rest.slice(0, 15),
    label: `Overpass · ${fuel.length} fuel · ${rest.length} rest/services`,
  };
}
