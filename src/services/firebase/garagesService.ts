import { addDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { MOCK_PLACES } from '../../data/mocks';
import { getFirebase } from '../../firebase/config';
import type { GarageDoc, GarageRatingDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { FALLBACK_LAT, FALLBACK_LON, getDeviceCoords } from '../geo/deviceLocation';
import { fetchNearbyAutoPlaces, withDistance } from '../osm/overpassPlaces';
import { fetchPhotonAutoPlaces } from '../osm/photonPlaces';
import { externalLiveResult, liveResult, mockResult, ServiceResult } from './result';

function fromMockPlaces(): GarageDoc[] {
  return MOCK_PLACES.filter((p) => p.kind !== 'pesage').map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind as GarageDoc['kind'],
    address: p.address,
    phone: p.phone,
    hours: p.hours,
    lat: p.lat,
    lon: p.lon,
    ratingAvg: 4.2,
    ratingCount: 3,
    updatedAt: new Date().toISOString(),
  }));
}

export type NearbyGaragesMeta = {
  lat: number;
  lon: number;
  gpsLabel: string;
  distanceById: Record<string, { distanceKm: number; etaMin: number }>;
};

/**
 * Module 9 — nearby garages / pieces / tow.
 * Prefer Overpass OSM around device GPS; Firestore if populated; else mock.
 */
export async function listGaragesNearby(): Promise<
  ServiceResult<GarageDoc[]> & { meta?: NearbyGaragesMeta }
> {
  const coordsRes = await getDeviceCoords({ allowFallback: true });
  const lat = coordsRes.data?.lat ?? FALLBACK_LAT;
  const lon = coordsRes.data?.lon ?? FALLBACK_LON;
  const gpsLabel = coordsRes.data?.label ?? 'GPS fallback';

  const osm = await fetchNearbyAutoPlaces(lat, lon, 10000);
  const photon =
    osm.ok && osm.places.length ? null : await fetchPhotonAutoPlaces(lat, lon);
  const livePlaces =
    osm.ok && osm.places.length
      ? { places: osm.places, label: osm.label }
      : photon?.ok && photon.places.length
        ? { places: photon.places, label: photon.label }
        : null;

  if (livePlaces) {
    const withDist = withDistance(livePlaces.places, lat, lon);
    const distanceById: NearbyGaragesMeta['distanceById'] = {};
    for (const p of withDist) {
      distanceById[p.id] = { distanceKm: p.distanceKm, etaMin: p.etaMin };
    }
    return {
      ...externalLiveResult(livePlaces.places, `${livePlaces.label} · ${gpsLabel}`),
      meta: { lat, lon, gpsLabel, distanceById },
    };
  }

  const fb = getFirebase();
  if (fb) {
    const snap = await getDocs(query(collection(fb.db, COLLECTIONS.garages), limit(50)));
    if (!snap.empty) {
      const places = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GarageDoc, 'id'>) }));
      const withDist = withDistance(places, lat, lon);
      const distanceById: NearbyGaragesMeta['distanceById'] = {};
      for (const p of withDist) {
        distanceById[p.id] = { distanceKm: p.distanceKm, etaMin: p.etaMin };
      }
      return {
        ...liveResult(places, `Garages Firestore LIVE · ${gpsLabel}`),
        meta: { lat, lon, gpsLabel, distanceById },
      };
    }
  }

  const mock = fromMockPlaces();
  const withDist = withDistance(mock, lat, lon);
  const distanceById: NearbyGaragesMeta['distanceById'] = {};
  for (const p of withDist) {
    distanceById[p.id] = { distanceKm: p.distanceKm, etaMin: p.etaMin };
  }
  const stub = `MOCK garages — Overpass: ${osm.label}${
    osm.error ? ` (${osm.error})` : ''
  } · Photon: ${photon?.label ?? 'n/a'} · ${gpsLabel}`;
  return {
    ...mockResult(mock, stub),
    meta: { lat, lon, gpsLabel, distanceById },
  };
}

export async function submitGarageRating(
  rating: Omit<GarageRatingDoc, 'id' | 'createdAt'>,
): Promise<ServiceResult<GarageRatingDoc>> {
  const payload: GarageRatingDoc = {
    ...rating,
    id: `rating-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  if (!fb) return mockResult(payload, 'MOCK garage rating — non syncé (hors Auth/Firebase)');
  const ref = await addDoc(collection(fb.db, COLLECTIONS.garageRatings), payload);
  return liveResult({ ...payload, id: ref.id });
}
