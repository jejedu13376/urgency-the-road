/**
 * Live places via Overpass API (OpenStreetMap, free, no key).
 * Used by M8 (weigh / dépôts) and M9 (garages / pièces).
 * Requires a polite User-Agent — some mirrors return 406 without one.
 */

import { etaMinutesFromKm, haversineKm } from '../geo/deviceLocation';
import type { GarageDoc, WeighStationDoc } from '../../types/firestore';

const UA = 'UrgencyRoad/1.0 (https://github.com/jejedu13376/urgency-the-road)';
const ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

type OsmTags = Record<string, string | undefined>;
type OsmEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

function coordsOf(el: OsmEl): { lat: number; lon: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lon: el.lon };
  if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

function addressOf(tags: OsmTags): string {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city'] ?? tags['addr:town']].filter(Boolean).join(' ');
  const contact = [tags['contact:housenumber'], tags['contact:street'], tags['contact:city']]
    .filter(Boolean)
    .join(' ');
  return street || city || contact || tags['addr:full'] || 'Adresse OSM partielle';
}

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

function mapGarageKind(tags: OsmTags): GarageDoc['kind'] {
  const shop = tags.shop ?? '';
  const amenity = tags.amenity ?? '';
  // Amenity first — brand alone must not force concession (Bosch / Feu Vert / Midas)
  if (amenity === 'towing' || amenity === 'vehicle_inspection') return 'depannage';
  if (amenity === 'car_repair') return 'garage';
  if (shop === 'car_parts' || shop === 'tyres') return 'pieces';
  if (shop === 'car' || shop === 'car_dealer' || amenity === 'car_dealer') return 'concession';
  if (tags.mobile === 'yes' || tags['service:vehicle:mobile'] === 'yes') return 'mobile';
  if (tags.hgv === 'yes' || tags['hgv:repair'] === 'yes' || tags.truck === 'yes') return 'depot_pl';
  return 'garage';
}

export type NearbyPlacesResult = {
  ok: boolean;
  places: GarageDoc[];
  source: 'overpass' | 'none';
  label: string;
  error?: string;
};

export async function fetchNearbyAutoPlaces(
  lat: number,
  lon: number,
  radiusM = 8000,
): Promise<NearbyPlacesResult> {
  const r = Math.min(Math.max(radiusM, 1500), 25000);
  const ql = `[out:json][timeout:28];
(
  node["amenity"="car_repair"](around:${r},${lat},${lon});
  way["amenity"="car_repair"](around:${r},${lat},${lon});
  node["shop"="car_parts"](around:${r},${lat},${lon});
  node["shop"="car"](around:${r},${lat},${lon});
  node["amenity"="towing"](around:${r},${lat},${lon});
  node["shop"="tyres"](around:${r},${lat},${lon});
);
out center tags 40;`;

  try {
    const els = await overpassQuery(ql);
    const places: GarageDoc[] = [];
    const seen = new Set<string>();
    for (const el of els) {
      const c = coordsOf(el);
      if (!c) continue;
      const tags = el.tags ?? {};
      const name = tags.name ?? tags.brand ?? tags.operator;
      if (!name) continue;
      const id = `osm-${el.type}-${el.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      places.push({
        id,
        name,
        kind: mapGarageKind(tags),
        address: addressOf(tags),
        phone: tags.phone ?? tags['contact:phone'] ?? 'N/A',
        hours: tags.opening_hours ?? 'Horaires OSM inconnus',
        lat: c.lat,
        lon: c.lon,
        ratingAvg: undefined,
        ratingCount: undefined,
        updatedAt: new Date().toISOString(),
      });
    }
    places.sort(
      (a, b) => haversineKm(lat, lon, a.lat, a.lon) - haversineKm(lat, lon, b.lat, b.lon),
    );
    return {
      ok: places.length > 0,
      places,
      source: 'overpass',
      label:
        places.length > 0
          ? `LIVE Overpass OSM · ${places.length} pin(s) · rayon ${Math.round(r / 1000)} km`
          : 'Overpass OSM vide dans le rayon — fallback mock',
      error: places.length ? undefined : 'Aucun POI auto dans le rayon',
    };
  } catch (e) {
    return {
      ok: false,
      places: [],
      source: 'none',
      label: 'Overpass KO — fallback mock',
      error: e instanceof Error ? e.message : 'Overpass error',
    };
  }
}

export type NearbyWeighResult = {
  ok: boolean;
  stations: WeighStationDoc[];
  source: 'overpass' | 'none';
  label: string;
  error?: string;
};

export function regionFromCountry(country?: string): WeighStationDoc['region'] {
  const c = (country ?? '').toUpperCase();
  if (['US', 'CA', 'MX'].includes(c)) return 'NA';
  if (['AU', 'NZ'].includes(c)) return 'AU';
  return 'EU';
}

/** Coarse region from WGS84 — used when OSM/Photon omit country tags. */
export function regionFromLatLon(lat: number, lon: number): WeighStationDoc['region'] {
  if (lat < -10 && lon > 110 && lon < 180) return 'AU';
  if (lat > 15 && lon > -170 && lon < -50) return 'NA';
  return 'EU';
}

export async function fetchNearbyWeighStations(
  lat: number,
  lon: number,
  radiusM = 80000,
): Promise<NearbyWeighResult> {
  const r = Math.min(Math.max(radiusM, 5000), 150000);
  const ql = `[out:json][timeout:28];
(
  node["amenity"="weighbridge"](around:${r},${lat},${lon});
  way["amenity"="weighbridge"](around:${r},${lat},${lon});
  node["highway"="weigh_station"](around:${r},${lat},${lon});
  node["man_made"="weighbridge"](around:${r},${lat},${lon});
);
out center tags 30;`;

  try {
    const els = await overpassQuery(ql);
    const stations: WeighStationDoc[] = [];
    for (const el of els) {
      const c = coordsOf(el);
      if (!c) continue;
      const tags = el.tags ?? {};
      const name = tags.name ?? tags.operator ?? `Pesage OSM #${el.id}`;
      // Static OSM tags (access=yes, 24/7) are NOT a live ON/OFF feed — stay unknown.
      const country = tags['addr:country'] ?? tags['is_in:country_code'];
      stations.push({
        id: `osm-w-${el.type}-${el.id}`,
        name,
        address: addressOf(tags),
        lat: c.lat,
        lon: c.lon,
        region: country ? regionFromCountry(country) : regionFromLatLon(c.lat, c.lon),
        status: 'unknown',
        litUp: false,
        heightLimitM: tags.maxheight ? Number.parseFloat(tags.maxheight) || undefined : undefined,
        weightLimitT: tags.maxweight ? Number.parseFloat(tags.maxweight) || undefined : undefined,
        updatedAt: new Date().toISOString(),
      });
    }
    stations.sort(
      (a, b) => haversineKm(lat, lon, a.lat, a.lon) - haversineKm(lat, lon, b.lat, b.lon),
    );
    return {
      ok: stations.length > 0,
      stations,
      source: 'overpass',
      label:
        stations.length > 0
          ? `LIVE Overpass OSM · ${stations.length} balance(s) · statut UNKNOWN (pas de feed ON/OFF live)`
          : 'Overpass pesage vide — fallback mock',
      error: stations.length ? undefined : 'Aucune weighbridge OSM proche',
    };
  } catch (e) {
    return {
      ok: false,
      stations: [],
      source: 'none',
      label: 'Overpass pesage KO — fallback mock',
      error: e instanceof Error ? e.message : 'Overpass error',
    };
  }
}

export type NearbyDepotResult = {
  ok: boolean;
  depots: GarageDoc[];
  source: 'overpass' | 'none';
  label: string;
};

export async function fetchNearbyTruckDepots(
  lat: number,
  lon: number,
  radiusM = 25000,
): Promise<NearbyDepotResult> {
  const r = Math.min(Math.max(radiusM, 3000), 60000);
  const ql = `[out:json][timeout:28];
(
  node["shop"="truck"](around:${r},${lat},${lon});
  node["shop"="car_parts"]["hgv"="yes"](around:${r},${lat},${lon});
  node["amenity"="fuel"]["hgv"="yes"](around:${r},${lat},${lon});
  node["industrial"="warehouse"]["hgv"="yes"](around:${r},${lat},${lon});
  node["amenity"="truck_stop"](around:${r},${lat},${lon});
);
out center tags 25;`;

  try {
    const els = await overpassQuery(ql);
    const depots: GarageDoc[] = [];
    for (const el of els) {
      const c = coordsOf(el);
      if (!c) continue;
      const tags = el.tags ?? {};
      const name = tags.name ?? tags.brand ?? tags.operator;
      if (!name) continue;
      depots.push({
        id: `osm-pl-${el.type}-${el.id}`,
        name,
        kind: 'depot_pl',
        address: addressOf(tags),
        phone: tags.phone ?? tags['contact:phone'] ?? 'N/A',
        hours: tags.opening_hours ?? 'Horaires OSM inconnus',
        lat: c.lat,
        lon: c.lon,
        updatedAt: new Date().toISOString(),
      });
    }
    depots.sort(
      (a, b) => haversineKm(lat, lon, a.lat, a.lon) - haversineKm(lat, lon, b.lat, b.lon),
    );
    return {
      ok: depots.length > 0,
      depots,
      source: 'overpass',
      label:
        depots.length > 0
          ? `LIVE Overpass · ${depots.length} dépôt(s)/relais PL`
          : 'Overpass PL vide — fallback mock',
    };
  } catch (e) {
    return {
      ok: false,
      depots: [],
      source: 'none',
      label: e instanceof Error ? `Overpass PL KO — ${e.message}` : 'Overpass PL KO',
    };
  }
}

/** Attach distance / ETA for UI lists. */
export function withDistance<T extends { lat: number; lon: number }>(
  items: T[],
  lat: number,
  lon: number,
): Array<T & { distanceKm: number; etaMin: number }> {
  return items.map((p) => {
    const distanceKm = Math.round(haversineKm(lat, lon, p.lat, p.lon) * 10) / 10;
    return { ...p, distanceKm, etaMin: etaMinutesFromKm(distanceKm) };
  });
}
