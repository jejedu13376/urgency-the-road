/**
 * Long-haul vehicle routing via public OSRM (Project OSRM demo).
 * Used when Valhalla FOSSGIS rejects paths over its ~1500 km max-distance cap
 * (common for AU / CA / US / EU cross-region trips) and TomTom is unavailable.
 *
 * Profile is car `driving` only — truck mode is labeled honestly (no PL graph).
 * https://router.project-osrm.org
 */
import type { GpsVehicleMode } from '../prefs/gpsNavPrefs';
import type { RoutePoint, VehicleRouteResult } from './valhallaRoute';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const UA = 'UrgencyRoad/1.0 (https://github.com/jejedu13376/urgency-the-road)';

type OsrmRoute = {
  distance?: number;
  duration?: number;
  geometry?: {
    coordinates?: [number, number][];
  };
};

type OsrmResponse = {
  code?: string;
  message?: string;
  routes?: OsrmRoute[];
};

function fail(
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

/** Lon,lat;lon,lat… path for OSRM (note axis order). */
export function buildOsrmCoordinates(
  from: RoutePoint,
  to: RoutePoint,
  waypoints?: RoutePoint[],
): string {
  const vias = (waypoints ?? [])
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .slice(0, 6);
  return [from, ...vias, to].map((p) => `${p.lon},${p.lat}`).join(';');
}

function coordsFromGeometry(route: OsrmRoute): [number, number][] {
  const out: [number, number][] = [];
  for (const c of route.geometry?.coordinates ?? []) {
    if (
      Array.isArray(c) &&
      typeof c[0] === 'number' &&
      typeof c[1] === 'number' &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1])
    ) {
      // GeoJSON is [lon, lat] → app uses [lat, lon]
      out.push([c[1], c[0]]);
    }
  }
  return out;
}

function routeToResult(
  route: OsrmRoute,
  mode: GpsVehicleMode,
  labelSuffix = '',
): VehicleRouteResult | null {
  const coords = coordsFromGeometry(route);
  if (coords.length < 2) return null;
  const distanceKm = Math.round(((route.distance ?? 0) / 1000) * 10) / 10;
  const durationMin = Math.max(1, Math.round((route.duration ?? 0) / 60));
  const truckNote =
    mode === 'camion'
      ? ' · profil OSRM voiture (pas de graphe PL gratuit longue distance)'
      : '';
  return {
    ok: true,
    mode,
    coords,
    distanceKm,
    durationMin,
    source: 'osrm',
    label: `LIVE OSRM driving · ${distanceKm} km · ~${durationMin} min${truckNote}${labelSuffix}`,
  };
}

async function postOsrm(
  from: RoutePoint,
  to: RoutePoint,
  waypoints: RoutePoint[] | undefined,
  alternatives: boolean,
): Promise<{ ok: boolean; body: OsrmResponse | null; raw: string; status: number }> {
  const path = buildOsrmCoordinates(from, to, waypoints);
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    alternatives: alternatives ? 'true' : 'false',
    steps: 'false',
  });
  // Path is numeric lon,lat;… — do not encode commas/semicolons (OSRM requires them raw).
  const url = `${OSRM_URL}/${path}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  const raw = await res.text();
  let body: OsrmResponse | null = null;
  try {
    body = JSON.parse(raw) as OsrmResponse;
  } catch {
    body = null;
  }
  return { ok: res.ok, body, raw, status: res.status };
}

/**
 * Fetch a driving polyline from public OSRM.
 * Returns real road geometry + ETA — never a straight-line haversine fake.
 */
export async function fetchOsrmRoute(
  from: RoutePoint,
  to: RoutePoint,
  mode: GpsVehicleMode,
  opts?: { waypoints?: RoutePoint[]; alternatives?: boolean },
): Promise<VehicleRouteResult> {
  if (
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lon) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lon)
  ) {
    return fail(mode, 'OSRM — coordonnées invalides', 'bad-coords');
  }

  try {
    const { ok, body, raw, status } = await postOsrm(
      from,
      to,
      opts?.waypoints,
      !!opts?.alternatives,
    );
    if (!ok || !body || body.code !== 'Ok' || !body.routes?.length) {
      const err = body?.message || body?.code || raw.slice(0, 160) || `HTTP ${status}`;
      return fail(mode, `OSRM KO — ${err}`, err);
    }
    const primary = routeToResult(body.routes[0], mode, ' · longue distance');
    if (!primary) return fail(mode, 'OSRM — tracé vide', 'empty geometry');
    return primary;
  } catch (e) {
    return fail(
      mode,
      'OSRM réseau KO',
      e instanceof Error ? e.message : 'network',
    );
  }
}

/**
 * Up to 3 OSRM alternatives (real road polylines).
 */
export async function fetchOsrmAlternatives(
  from: RoutePoint,
  to: RoutePoint,
  mode: GpsVehicleMode,
  opts?: { waypoints?: RoutePoint[] },
): Promise<VehicleRouteResult[]> {
  if (
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lon) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lon)
  ) {
    return [fail(mode, 'OSRM — coordonnées invalides', 'bad-coords')];
  }

  try {
    const { ok, body, raw, status } = await postOsrm(from, to, opts?.waypoints, true);
    if (!ok || !body || body.code !== 'Ok' || !body.routes?.length) {
      const err = body?.message || body?.code || raw.slice(0, 160) || `HTTP ${status}`;
      return [fail(mode, `OSRM KO — ${err}`, err)];
    }
    const out: VehicleRouteResult[] = [];
    for (const r of body.routes.slice(0, 3)) {
      const converted = routeToResult(r, mode, out.length === 0 ? ' · longue distance' : '');
      if (converted) out.push(converted);
    }
    return out.length
      ? out
      : [fail(mode, 'OSRM — tracé vide', 'empty geometry')];
  } catch (e) {
    return [
      fail(mode, 'OSRM réseau KO', e instanceof Error ? e.message : 'network'),
    ];
  }
}
