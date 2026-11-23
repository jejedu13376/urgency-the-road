import { addDoc, collection, getDocs, limit, query, where } from 'firebase/firestore';
import { MOCK_PLACES } from '../../data/mocks';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type { GarageDoc, GarageRatingDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { FALLBACK_LAT, FALLBACK_LON, getDeviceCoords } from '../geo/deviceLocation';
import { fetchNearbyAutoPlaces, withDistance } from '../osm/overpassPlaces';
import { fetchPhotonAutoPlaces } from '../osm/photonPlaces';
import { isDevSoftAuth, isPermissionDenied } from './devSoftAuth';
import { externalLiveResult, failResult, liveResult, mockResult, ServiceResult } from './result';

/** Aggregate Firestore garageRatings onto OSM/Photon docs by garageId (= OSM id). */
async function joinGarageRatings(places: GarageDoc[]): Promise<GarageDoc[]> {
  const fb = getFirebase();
  if (!fb || !places.length) return places;
  const ids = places.map((p) => p.id).filter(Boolean);
  const agg = new Map<string, { sum: number; count: number }>();
  // Firestore `in` max 30 — batch
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    try {
      const snap = await getDocs(
        query(collection(fb.db, COLLECTIONS.garageRatings), where('garageId', 'in', chunk)),
      );
      for (const d of snap.docs) {
        const data = d.data() as GarageRatingDoc;
        const gid = data.garageId;
        if (!gid) continue;
        const stars = Number(data.stars);
        if (!Number.isFinite(stars)) continue;
        const cur = agg.get(gid) ?? { sum: 0, count: 0 };
        cur.sum += stars;
        cur.count += 1;
        agg.set(gid, cur);
      }
    } catch {
      // Ratings optional — keep OSM list without stars
    }
  }
  if (!agg.size) return places;
  return places.map((p) => {
    const hit = agg.get(p.id);
    if (!hit || !hit.count) return p;
    return {
      ...p,
      ratingAvg: Math.round((hit.sum / hit.count) * 10) / 10,
      ratingCount: hit.count,
    };
  });
}

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
 * @param radiusKm search radius (default 10 km, clamped 2–25).
 */
export async function listGaragesNearby(opts?: {
  radiusKm?: number;
}): Promise<ServiceResult<GarageDoc[]> & { meta?: NearbyGaragesMeta }> {
  const coordsRes = await getDeviceCoords({ allowFallback: true });
  const lat = coordsRes.data?.lat ?? FALLBACK_LAT;
  const lon = coordsRes.data?.lon ?? FALLBACK_LON;
  const gpsLabel = coordsRes.data?.label ?? 'GPS fallback';
  const radiusKm = Math.min(Math.max(opts?.radiusKm ?? 10, 2), 25);
  const radiusM = radiusKm * 1000;

  const osm = await fetchNearbyAutoPlaces(lat, lon, radiusM);
  const photon =
    osm.ok && osm.places.length ? null : await fetchPhotonAutoPlaces(lat, lon);
  const livePlaces =
    osm.ok && osm.places.length
      ? { places: osm.places, label: osm.label }
      : photon?.ok && photon.places.length
        ? { places: photon.places, label: photon.label }
        : null;

  if (livePlaces) {
    const rated = await joinGarageRatings(livePlaces.places);
    const withDist = withDistance(rated, lat, lon);
    const distanceById: NearbyGaragesMeta['distanceById'] = {};
    for (const p of withDist) {
      distanceById[p.id] = { distanceKm: p.distanceKm, etaMin: p.etaMin };
    }
    return {
      ...externalLiveResult(rated, `${livePlaces.label} · ${gpsLabel}`),
      meta: { lat, lon, gpsLabel, distanceById },
    };
  }

  const fb = getFirebase();
  if (fb) {
    try {
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
    } catch {
      // Fall through to mock — Firestore read failed
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
  const uid = getSignedInUid();
  const payload: GarageRatingDoc = {
    ...rating,
    authorUid: uid ?? rating.authorUid,
    id: `rating-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  if (!fb || !uid) {
    return mockResult(payload, 'MOCK garage rating — Auth requise pour sync Firestore');
  }
  const owned = { ...payload, authorUid: uid };
  try {
    const ref = await addDoc(collection(fb.db, COLLECTIONS.garageRatings), owned);
    return liveResult({ ...owned, id: ref.id });
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return failResult(owned, 'SOFT garage rating — permission/DEV (local, ok:false)');
    }
    return failResult(owned, e instanceof Error ? e.message : 'Note garage refusée');
  }
}
