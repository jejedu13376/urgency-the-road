import { collection, getDocs, limit, query } from 'firebase/firestore';
import { MOCK_PLACES } from '../../data/mocks';
import { getFirebase } from '../../firebase/config';
import type { GarageDoc, WeighStationDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { FALLBACK_LAT, FALLBACK_LON, getDeviceCoords } from '../geo/deviceLocation';
import {
  fetchNearbyTruckDepots,
  fetchNearbyWeighStations,
  regionFromLatLon,
  withDistance,
} from '../osm/overpassPlaces';
import { fetchPhotonWeighHints } from '../osm/photonPlaces';
import { externalLiveResult, liveResult, mockResult, ServiceResult } from './result';

function mockStations(): WeighStationDoc[] {
  return MOCK_PLACES.filter((p) => p.kind === 'pesage').map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    lat: p.lat,
    lon: p.lon,
    region: 'EU',
    status: 'open',
    litUp: true,
    heightLimitM: 4.2,
    weightLimitT: 44,
    updatedAt: new Date().toISOString(),
  }));
}

export type WeighListMeta = {
  lat: number;
  lon: number;
  gpsLabel: string;
  depots: Array<GarageDoc & { distanceKm: number; etaMin: number }>;
  depotLabel: string;
};

/**
 * Module 8 — weigh stations near device GPS via Overpass (amenity=weighbridge).
 * ON/OFF live feeds do not exist as a free global API — unknown stays unknown (no fake ON).
 * @param radiusKm weigh search radius (default 100 km, clamped 20–150).
 */
export async function listWeighStations(opts?: {
  radiusKm?: number;
}): Promise<ServiceResult<WeighStationDoc[]> & { meta?: WeighListMeta }> {
  const coordsRes = await getDeviceCoords({ allowFallback: true });
  const lat = coordsRes.data?.lat ?? FALLBACK_LAT;
  const lon = coordsRes.data?.lon ?? FALLBACK_LON;
  const gpsLabel = coordsRes.data?.label ?? 'GPS fallback';
  const radiusKm = Math.min(Math.max(opts?.radiusKm ?? 100, 20), 150);
  const depotRadiusM = Math.min(Math.max(Math.round(radiusKm * 300), 10000), 60000);

  const [weigh, depotsRes] = await Promise.all([
    fetchNearbyWeighStations(lat, lon, radiusKm * 1000),
    fetchNearbyTruckDepots(lat, lon, depotRadiusM),
  ]);

  const depots = withDistance(
    depotsRes.ok && depotsRes.depots.length
      ? depotsRes.depots
      : MOCK_PLACES.filter((p) => p.kind === 'depot_pl' || p.kind === 'pieces').map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind as GarageDoc['kind'],
          address: p.address,
          phone: p.phone,
          hours: p.hours,
          lat: p.lat,
          lon: p.lon,
          updatedAt: new Date().toISOString(),
        })),
    lat,
    lon,
  );

  const depotLabel =
    depotsRes.ok && depotsRes.depots.length
      ? depotsRes.label
      : `${depotsRes.label} · dépôts mock`;

  if (weigh.ok && weigh.stations.length) {
    return {
      ...externalLiveResult(weigh.stations, `${weigh.label} · ${gpsLabel}`),
      meta: { lat, lon, gpsLabel, depots, depotLabel },
    };
  }

  // Cap Photon hits to Overpass weigh radius — no distant pins as « nearby »
  const photon = await fetchPhotonWeighHints(lat, lon, radiusKm);
  if (photon.ok && photon.stations.length) {
    const stations: WeighStationDoc[] = photon.stations.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lon: s.lon,
      region: regionFromLatLon(s.lat, s.lon),
      status: 'unknown',
      litUp: false,
      updatedAt: new Date().toISOString(),
    }));
    return {
      ...externalLiveResult(stations, `${photon.label} · ${gpsLabel}`),
      meta: { lat, lon, gpsLabel, depots, depotLabel },
    };
  }

  const fb = getFirebase();
  if (fb) {
    const snap = await getDocs(query(collection(fb.db, COLLECTIONS.weighStations), limit(50)));
    if (!snap.empty) {
      return {
        ...liveResult(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WeighStationDoc, 'id'>) })),
          `Weigh Firestore LIVE · ${gpsLabel}`,
        ),
        meta: { lat, lon, gpsLabel, depots, depotLabel },
      };
    }
  }

  return {
    ...mockResult(
      mockStations(),
      `MOCK weigh — ${weigh.label}${weigh.error ? ` (${weigh.error})` : ''} · ${photon.label} · ${gpsLabel}`,
    ),
    meta: { lat, lon, gpsLabel, depots, depotLabel },
  };
}
