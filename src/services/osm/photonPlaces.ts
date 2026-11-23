/**
 * Photon (Komoot) free geocoder/search — fallback when Overpass is slow/502.
 * https://photon.komoot.io
 */
import type { GarageDoc } from '../../types/firestore';
import { haversineKm } from '../geo/deviceLocation';

/** Same default radius as Overpass weigh search (100 km). */
const WEIGH_MAX_KM = 100;

const UA = 'UrgencyRoad/1.0 (https://github.com/jejedu13376/urgency-the-road)';

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

function kindFromPhoton(key?: string, value?: string): GarageDoc['kind'] {
  if (value === 'car_parts' || value === 'tyres') return 'pieces';
  if (value === 'car') return 'concession';
  if (value === 'towing') return 'depannage';
  if (key === 'shop' && value === 'truck') return 'depot_pl';
  return 'garage';
}

async function photonSearch(
  q: string,
  lat: number,
  lon: number,
  limit: number,
): Promise<GarageDoc[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
  const body = (await res.json()) as { features?: PhotonFeature[] };
  const out: GarageDoc[] = [];
  for (const f of body.features ?? []) {
    const coords = f.geometry?.coordinates;
    const p = f.properties;
    if (!coords || !p?.name) continue;
    const [lonP, latP] = coords;
    const address = [p.housenumber, p.street, p.postcode, p.city].filter(Boolean).join(' ') || 'Adresse Photon';
    out.push({
      id: `photon-${p.osm_type ?? 'n'}-${p.osm_id ?? `${latP}-${lonP}`}`,
      name: p.name,
      kind: kindFromPhoton(p.osm_key, p.osm_value),
      address,
      phone: 'N/A',
      hours: 'Horaires non fournis (Photon)',
      lat: latP,
      lon: lonP,
      updatedAt: new Date().toISOString(),
    });
  }
  return out;
}

export async function fetchPhotonWeighHints(
  lat: number,
  lon: number,
  maxKm = WEIGH_MAX_KM,
): Promise<{
  ok: boolean;
  stations: Array<{
    id: string;
    name: string;
    address: string;
    lat: number;
    lon: number;
  }>;
  label: string;
}> {
  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', 'weigh station');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('limit', '12');
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
    const body = (await res.json()) as { features?: PhotonFeature[] };
    const cap = Math.max(5, maxKm);
    const stations = (body.features ?? [])
      .map((f) => {
        const coords = f.geometry?.coordinates;
        const p = f.properties;
        if (!coords || !p?.name) return null;
        const [lonP, latP] = coords;
        if (haversineKm(lat, lon, latP, lonP) > cap) return null;
        return {
          id: `photon-w-${p.osm_type ?? 'n'}-${p.osm_id ?? `${latP}-${lonP}`}`,
          name: p.name,
          address: [p.street, p.city, p.country].filter(Boolean).join(', ') || 'Photon',
          lat: latP,
          lon: lonP,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      address: string;
      lat: number;
      lon: number;
    }>;
    return {
      ok: stations.length > 0,
      stations,
      label: stations.length
        ? `LIVE Photon · ${stations.length} weigh ≤${cap} km · statut UNKNOWN (pas de feed ON/OFF)`
        : `Photon weigh vide dans ${cap} km`,
    };
  } catch (e) {
    return {
      ok: false,
      stations: [],
      label: e instanceof Error ? `Photon weigh KO — ${e.message}` : 'Photon weigh KO',
    };
  }
}

export async function fetchPhotonAutoPlaces(
  lat: number,
  lon: number,
): Promise<{ ok: boolean; places: GarageDoc[]; label: string; error?: string }> {
  try {
    const batches = await Promise.all([
      photonSearch('garage automobile', lat, lon, 8),
      photonSearch('pièces auto', lat, lon, 6),
      photonSearch('dépanneuse', lat, lon, 4),
    ]);
    const map = new Map<string, GarageDoc>();
    for (const list of batches) {
      for (const p of list) {
        if (!map.has(p.id)) map.set(p.id, p);
      }
    }
    const places = [...map.values()].sort(
      (a, b) => haversineKm(lat, lon, a.lat, a.lon) - haversineKm(lat, lon, b.lat, b.lon),
    );
    return {
      ok: places.length > 0,
      places,
      label:
        places.length > 0
          ? `LIVE Photon OSM · ${places.length} pin(s)`
          : 'Photon vide — fallback mock',
    };
  } catch (e) {
    return {
      ok: false,
      places: [],
      label: 'Photon KO — fallback mock',
      error: e instanceof Error ? e.message : 'Photon error',
    };
  }
}
