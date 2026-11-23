/**
 * Free vehicle routing via FOSSGIS Valhalla public demo (no API key).
 * https://valhalla1.openstreetmap.de
 *
 * - voiture → costing `auto`
 * - camion → costing `truck` (+ height/width/length/weight/axles)
 *
 * Never silently fall back to `auto` when the user asked for truck.
 * Not a commercial PTAC / legal clearance graph. Pair with OSM maxheight advisories.
 */
import { decodePolyline6 } from './polyline6';
import type { GpsVehicleMode } from '../prefs/gpsNavPrefs';
import { parseValhallaManeuvers, type RouteManeuver } from '../gps/routeManeuvers';

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';
const UA = 'UrgencyRoad/1.0 (https://github.com/jejedu13376/urgency-the-road)';

export type RoutePoint = { lat: number; lon: number };
export type { RouteManeuver };

export type VehicleRouteResult = {
  ok: boolean;
  mode: GpsVehicleMode;
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
  source: 'valhalla-auto' | 'valhalla-truck' | 'none';
  label: string;
  error?: string;
  /** True when truck succeeded only after relaxing dimensions (still truck costing). */
  relaxedTruck?: boolean;
  /** Narrative turns for TTS (empty when Valhalla omits maneuvers). */
  maneuvers?: RouteManeuver[];
};

export type TruckDims = {
  heightM?: number;
  widthM?: number;
  weightT?: number;
  lengthM?: number;
  axleLoadT?: number;
  axleCount?: number;
  hazmat?: boolean;
};

type ValhallaTrip = {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: {
      shape?: string;
      maneuvers?: {
        instruction?: string;
        verbal_transition_alert_instruction?: string;
        verbal_pre_transition_instruction?: string;
        length?: number;
        type?: number;
        begin_shape_index?: number;
        end_shape_index?: number;
      }[];
    }[];
  };
  error?: string;
  error_code?: number;
  status?: string;
  status_message?: string;
};

/** Valhalla truck costing expects metric tonnes + meters; clamp to sane ranges. */
export function normalizeTruckCosting(truck?: TruckDims): Record<string, number | boolean> {
  const height = clamp(truck?.heightM ?? 4.0, 2.5, 5.0);
  const width = clamp(truck?.widthM ?? 2.55, 2.0, 3.0);
  const weight = clamp(truck?.weightT ?? 19.0, 3.5, 44.0);
  const length = clamp(truck?.lengthM ?? 12.0, 6.0, 25.0);
  const axle_load = clamp(truck?.axleLoadT ?? 8.0, 4.0, 12.0);
  const axle_count = Math.round(clamp(truck?.axleCount ?? 3, 2, 6));
  const out: Record<string, number | boolean> = {
    height,
    width,
    length,
    weight,
    axle_load,
    axle_count,
  };
  if (truck?.hazmat) out.hazmat = true;
  return out;
}

/** Softer truck profile for NoPath retries — still `truck`, never `auto`. */
export function relaxedTruckCosting(truck?: TruckDims): Record<string, number | boolean> {
  const base = normalizeTruckCosting(truck);
  return {
    ...base,
    height: Math.min(Number(base.height) || 4, 3.8),
    width: Math.min(Number(base.width) || 2.55, 2.5),
    length: Math.min(Number(base.length) || 12, 10),
    weight: Math.min(Number(base.weight) || 19, 12),
    axle_load: Math.min(Number(base.axle_load) || 8, 8),
    axle_count: Math.min(Number(base.axle_count) || 3, 3),
    hazmat: false,
  };
}

export function buildValhallaPayload(
  from: RoutePoint,
  to: RoutePoint,
  mode: GpsVehicleMode,
  truck?: TruckDims,
  opts?: { relaxed?: boolean; excludeLocations?: RoutePoint[] },
): Record<string, unknown> {
  const costing = mode === 'camion' ? 'truck' : 'auto';
  const payload: Record<string, unknown> = {
    locations: [
      { lat: from.lat, lon: from.lon },
      { lat: to.lat, lon: to.lon },
    ],
    costing,
    // Valhalla 3.x prefers top-level units/language (directions_options deprecated).
    units: 'kilometers',
    language: 'fr-FR',
  };

  if (mode === 'camion') {
    payload.costing_options = {
      truck: opts?.relaxed ? relaxedTruckCosting(truck) : normalizeTruckCosting(truck),
    };
  }

  // FOSSGIS supports exclude_locations (incident detour). No free live traffic feed.
  const excludes = (opts?.excludeLocations ?? [])
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .slice(0, 12)
    .map((p) => ({ lat: p.lat, lon: p.lon }));
  if (excludes.length) {
    payload.exclude_locations = excludes;
  }

  return payload;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function failResult(
  mode: GpsVehicleMode,
  label: string,
  error?: string,
): VehicleRouteResult {
  return {
    ok: false,
    mode,
    coords: [],
    distanceKm: 0,
    durationMin: 0,
    source: 'none',
    label,
    error,
  };
}

function parseValhallaError(status: number, body: ValhallaTrip | null, rawText: string): string {
  if (body?.error) return body.error;
  if (body?.status_message) return body.status_message;
  if (rawText) return rawText.slice(0, 180);
  return `HTTP ${status}`;
}

async function postValhalla(payload: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  body: ValhallaTrip | null;
  rawText: string;
}> {
  const res = await fetch(VALHALLA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify(payload),
  });
  const rawText = await res.text();
  let body: ValhallaTrip | null = null;
  try {
    body = JSON.parse(rawText) as ValhallaTrip;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body, rawText };
}

function tripToResult(
  mode: GpsVehicleMode,
  body: ValhallaTrip,
  opts?: { relaxed?: boolean },
): VehicleRouteResult {
  const shape = body.trip?.legs?.[0]?.shape;
  if (!shape) {
    return failResult(
      mode,
      body.error ?? 'Itinéraire Valhalla vide',
      body.error ?? 'empty shape',
    );
  }
  const coords = decodePolyline6(shape);
  const distanceKm = Math.round((body.trip?.summary?.length ?? 0) * 10) / 10;
  const durationMin = Math.max(1, Math.round((body.trip?.summary?.time ?? 0) / 60));
  const source = mode === 'camion' ? 'valhalla-truck' : 'valhalla-auto';
  const maneuvers = parseValhallaManeuvers(body);
  if (mode === 'camion') {
    const relaxedNote = opts?.relaxed
      ? ' · profil camion assoupli (gabarit demandé trop restrictif)'
      : '';
    return {
      ok: true,
      mode,
      coords,
      distanceKm,
      durationMin,
      source,
      relaxedTruck: !!opts?.relaxed,
      maneuvers,
      label: `LIVE Valhalla truck · ${distanceKm} km · ~${durationMin} min${relaxedNote} · gabarit advisory (pas de graphe PTAC commercial)`,
    };
  }
  return {
    ok: true,
    mode,
    coords,
    distanceKm,
    durationMin,
    source,
    maneuvers,
    label: `LIVE Valhalla auto · ${distanceKm} km · ~${durationMin} min`,
  };
}

export async function fetchVehicleRoute(
  from: RoutePoint,
  to: RoutePoint,
  mode: GpsVehicleMode,
  truck?: TruckDims,
  routeOpts?: { excludeLocations?: RoutePoint[] },
): Promise<VehicleRouteResult> {
  const excludeLocations = routeOpts?.excludeLocations;
  const hasExcludes = !!(excludeLocations && excludeLocations.length);

  const labelOk = (
    result: VehicleRouteResult,
    opts?: { withExcludes?: boolean; droppedExcludes?: string; relaxedNote?: string },
  ): VehicleRouteResult => {
    const parts = [result.label];
    if (opts?.withExcludes && hasExcludes) {
      parts.push(`détour signalements (${excludeLocations!.length})`);
    }
    if (opts?.droppedExcludes) {
      parts.push(`sans exclusion (${opts.droppedExcludes})`);
    }
    if (opts?.relaxedNote) parts.push(opts.relaxedNote);
    parts.push('ETA sans trafic live');
    if (!opts?.withExcludes && !opts?.droppedExcludes) {
      parts.push('(pas d’API Waze/Google)');
    }
    return { ...result, label: parts.join(' · ') };
  };

  try {
    const primary = await postValhalla(
      buildValhallaPayload(from, to, mode, truck, { excludeLocations }),
    );
    if (primary.ok && primary.body?.trip?.legs?.[0]?.shape) {
      return labelOk(tripToResult(mode, primary.body), { withExcludes: hasExcludes });
    }

    const primaryErr = parseValhallaError(primary.status, primary.body, primary.rawText);

    // If exclusions caused NoPath, retry same costing without them (honest label — not silent).
    if (hasExcludes) {
      const noEx = await postValhalla(
        buildValhallaPayload(from, to, mode, truck, { excludeLocations: undefined }),
      );
      if (noEx.ok && noEx.body?.trip?.legs?.[0]?.shape) {
        return labelOk(tripToResult(mode, noEx.body), {
          droppedExcludes: `détour KO: ${primaryErr}`,
        });
      }
    }

    // Truck NoPath / restrict → relaxed-truck retry without excludes (still truck, never auto).
    if (mode === 'camion') {
      const retry = await postValhalla(
        buildValhallaPayload(from, to, mode, truck, {
          relaxed: true,
          excludeLocations: undefined,
        }),
      );
      if (retry.ok && retry.body?.trip?.legs?.[0]?.shape) {
        return labelOk(tripToResult(mode, retry.body, { relaxed: true }), {
          droppedExcludes: hasExcludes ? `détour KO: ${primaryErr}` : undefined,
          relaxedNote: `(échec gabarit strict: ${primaryErr})`,
        });
      }
      const retryErr = parseValhallaError(retry.status, retry.body, retry.rawText);
      return failResult(
        mode,
        `Camion Valhalla KO — ${retryErr}. Pas de bascule silencieuse vers voiture.`,
        `truck failed: ${primaryErr}; relaxed: ${retryErr}`,
      );
    }

    return failResult(mode, `Valhalla HTTP ${primary.status} — ${primaryErr}`, primaryErr);
  } catch (e) {
    return failResult(
      mode,
      mode === 'camion'
        ? 'Valhalla camion réseau KO — pas de bascule silencieuse vers voiture'
        : 'Valhalla réseau KO',
      e instanceof Error ? e.message : 'network',
    );
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
