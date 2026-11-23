/**
 * Free vehicle routing via FOSSGIS Valhalla public demo (no API key).
 * https://valhalla1.openstreetmap.de
 *
 * - voiture → costing `auto`
 * - camion → costing `truck` (+ height/width/weight) — routes can differ on longer trips
 *
 * Not a commercial PTAC / legal clearance graph. Pair with OSM maxheight advisories.
 */
import { decodePolyline6 } from './polyline6';
import type { GpsVehicleMode } from '../prefs/gpsNavPrefs';

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';
const UA = 'UrgencyRoad/1.0 (https://github.com/jejedu13376/urgency-the-road)';

export type RoutePoint = { lat: number; lon: number };

export type VehicleRouteResult = {
  ok: boolean;
  mode: GpsVehicleMode;
  coords: Array<[number, number]>;
  distanceKm: number;
  durationMin: number;
  source: 'valhalla-auto' | 'valhalla-truck' | 'none';
  label: string;
  error?: string;
};

export type TruckDims = {
  heightM?: number;
  widthM?: number;
  weightT?: number;
};

type ValhallaTrip = {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: Array<{ shape?: string }>;
  };
  error?: string;
  error_code?: number;
};

export async function fetchVehicleRoute(
  from: RoutePoint,
  to: RoutePoint,
  mode: GpsVehicleMode,
  truck?: TruckDims,
): Promise<VehicleRouteResult> {
  const costing = mode === 'camion' ? 'truck' : 'auto';
  const payload: Record<string, unknown> = {
    locations: [
      { lat: from.lat, lon: from.lon },
      { lat: to.lat, lon: to.lon },
    ],
    costing,
    directions_options: { units: 'kilometers', language: 'fr-FR' },
  };

  if (mode === 'camion') {
    payload.costing_options = {
      truck: {
        height: truck?.heightM ?? 4.0,
        width: truck?.widthM ?? 2.55,
        // Valhalla expects metric tonnes for weight in many builds; keep PTAC in tonnes.
        weight: truck?.weightT ?? 40,
      },
    };
  }

  try {
    const res = await fetch(VALHALLA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': UA,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        ok: false,
        mode,
        coords: [],
        distanceKm: 0,
        durationMin: 0,
        source: 'none',
        label: `Valhalla HTTP ${res.status}`,
        error: `HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as ValhallaTrip;
    const shape = body.trip?.legs?.[0]?.shape;
    if (!shape) {
      return {
        ok: false,
        mode,
        coords: [],
        distanceKm: 0,
        durationMin: 0,
        source: 'none',
        label: body.error ?? 'Itinéraire Valhalla vide',
        error: body.error ?? 'empty shape',
      };
    }
    const coords = decodePolyline6(shape);
    const distanceKm = Math.round((body.trip?.summary?.length ?? 0) * 10) / 10;
    const durationMin = Math.max(1, Math.round((body.trip?.summary?.time ?? 0) / 60));
    const source = mode === 'camion' ? 'valhalla-truck' : 'valhalla-auto';
    const label =
      mode === 'camion'
        ? `LIVE Valhalla truck · ${distanceKm} km · ~${durationMin} min · gabarit advisory (pas de graphe PTAC commercial)`
        : `LIVE Valhalla auto · ${distanceKm} km · ~${durationMin} min`;
    return { ok: true, mode, coords, distanceKm, durationMin, source, label };
  } catch (e) {
    return {
      ok: false,
      mode,
      coords: [],
      distanceKm: 0,
      durationMin: 0,
      source: 'none',
      label: 'Valhalla réseau KO',
      error: e instanceof Error ? e.message : 'network',
    };
  }
}

/** Google / Apple / Waze handoff. No free public truck travelmode URL — label honestly. */
export function mapsHandoffUrls(dest: RoutePoint, mode: GpsVehicleMode): {
  google: string;
  waze: string;
  apple: string;
  truckNote: string | null;
} {
  const ll = `${dest.lat},${dest.lon}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving`,
    waze: `https://waze.com/ul?ll=${dest.lat}%2C${dest.lon}&navigate=yes`,
    apple: `http://maps.apple.com/?daddr=${ll}&dirflg=d`,
    truckNote:
      mode === 'camion'
        ? 'Apps Maps/Waze n’exposent pas un mode PL gratuit via URL — gabarit / PTAC = advisory in-app (Valhalla truck + OSM maxheight).'
        : null,
  };
}
