/**
 * TomTom Calculate Route — alternatives, avoid, eco, toll sections, fuel.
 * Requires EXPO_PUBLIC_TOMTOM_API_KEY (same key as traffic tiles).
 */
import type { GpsVehicleMode } from '../prefs/gpsNavPrefs';
import type { RoutePoint, TruckDims } from './valhallaRoute';
import { estimateFuelCost, estimateTollCost } from './routeCostEstimate';

const UA = 'UrgencyRoad/1.0 (https://github.com/jejedu13376/urgency-the-road)';

export type RouteAvoidOptions = {
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  eco: boolean;
};

export const DEFAULT_ROUTE_AVOID: RouteAvoidOptions = {
  avoidTolls: false,
  avoidHighways: false,
  avoidFerries: false,
  eco: false,
};

export type ItineraryRouteOption = {
  id: string;
  /** Short FR label for the sheet (Rapide / Éco / Alt…). */
  title: string;
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
  hasTolls: boolean;
  tollSectionKm: number;
  tollCostCad: number | null;
  tollLabel: string;
  fuelLiters: number;
  fuelCostCad: number;
  fuelLabel: string;
  source: 'tomtom' | 'valhalla-auto' | 'valhalla-truck' | 'osrm';
  label: string;
};

export type ItineraryPlanResult = {
  ok: boolean;
  mode: GpsVehicleMode;
  options: ItineraryRouteOption[];
  /** Selected / primary option index. */
  selectedIndex: number;
  engine: 'tomtom' | 'valhalla' | 'osrm' | 'none';
  error?: string;
  label: string;
};

/**
 * Prefer EXPO_PUBLIC_TOMTOM_API_KEY (Expo client bundle). Also accept TOMTOM_API_KEY
 * when injected in Node/cloud test shells so routing works without a rename.
 */
export function isTomTomRoutingConfigured(): boolean {
  return !!tomtomKey();
}

function tomtomKey(): string {
  return (
    process.env.EXPO_PUBLIC_TOMTOM_API_KEY ??
    process.env.TOMTOM_API_KEY ??
    ''
  ).trim();
}

type TomTomPoint = { latitude?: number; longitude?: number };
type TomTomSection = {
  sectionType?: string;
  startPointIndex?: number;
  endPointIndex?: number;
};
type TomTomRoute = {
  summary?: {
    lengthInMeters?: number;
    travelTimeInSeconds?: number;
    trafficDelayInSeconds?: number;
    fuelConsumptionInLiters?: number;
  };
  legs?: { points?: TomTomPoint[] }[];
  sections?: TomTomSection[];
};

type TomTomResponse = {
  routes?: TomTomRoute[];
  error?: string;
  detailedError?: { message?: string };
};

function pointsToCoords(route: TomTomRoute): [number, number][] {
  const out: [number, number][] = [];
  for (const leg of route.legs ?? []) {
    for (const p of leg.points ?? []) {
      if (
        typeof p.latitude === 'number' &&
        typeof p.longitude === 'number' &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude)
      ) {
        out.push([p.latitude, p.longitude]);
      }
    }
  }
  return out;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function tollSectionKm(route: TomTomRoute, coords: [number, number][]): number {
  let km = 0;
  for (const s of route.sections ?? []) {
    const t = (s.sectionType ?? '').toLowerCase();
    if (t !== 'toll' && t !== 'tollroad' && t !== 'tollvignette') continue;
    const a = s.startPointIndex ?? 0;
    const b = s.endPointIndex ?? a;
    for (let i = a; i < b && i + 1 < coords.length; i++) {
      km += haversineKm(coords[i], coords[i + 1]);
    }
  }
  return Math.round(km * 10) / 10;
}

function optionTitle(index: number, avoid: RouteAvoidOptions, ecoForced: boolean): string {
  if (index === 0) {
    if (ecoForced || avoid.eco) return 'Éco';
    if (avoid.avoidTolls) return 'Sans péage';
    if (avoid.avoidHighways) return 'Sans autoroute';
    return 'Rapide';
  }
  if (index === 1) return avoid.eco ? 'Rapide' : 'Autre';
  return `Option ${index + 1}`;
}

function routeToOption(
  route: TomTomRoute,
  mode: GpsVehicleMode,
  index: number,
  avoid: RouteAvoidOptions,
  ecoForced: boolean,
): ItineraryRouteOption | null {
  const coords = pointsToCoords(route);
  if (coords.length < 2) return null;
  const distanceKm =
    Math.round(((route.summary?.lengthInMeters ?? 0) / 1000) * 10) / 10;
  const durationMin = Math.max(
    1,
    Math.round((route.summary?.travelTimeInSeconds ?? 0) / 60),
  );
  const sectionKm = tollSectionKm(route, coords);
  const toll = estimateTollCost(mode, { tollSectionKm: sectionKm });
  const fuel = estimateFuelCost(
    distanceKm,
    mode,
    route.summary?.fuelConsumptionInLiters,
  );
  const title = optionTitle(index, avoid, ecoForced);
  return {
    id: `tomtom-${index}-${distanceKm}-${durationMin}`,
    title,
    coords,
    distanceKm,
    durationMin,
    hasTolls: sectionKm > 0.05,
    tollSectionKm: toll.sectionKm,
    tollCostCad: toll.costCad,
    tollLabel: toll.label,
    fuelLiters: fuel.liters,
    fuelCostCad: fuel.costCad,
    fuelLabel:
      fuel.source === 'tomtom'
        ? `Essence TomTom · ${fuel.liters} L · ~${fuel.costCad.toFixed(2)} $`
        : `Essence estimée · ${fuel.liters} L · ~${fuel.costCad.toFixed(2)} $`,
    source: 'tomtom',
    label: `TomTom ${title} · ${distanceKm} km · ~${durationMin} min`,
  };
}

/**
 * Fetch up to 3 TomTom routes (primary + alternatives).
 * When eco is on, primary uses routeType=eco; still request alternatives.
 */
export async function fetchTomTomItinerary(
  from: RoutePoint,
  to: RoutePoint,
  mode: GpsVehicleMode,
  avoid: RouteAvoidOptions = DEFAULT_ROUTE_AVOID,
  opts?: {
    waypoints?: RoutePoint[];
    truck?: TruckDims;
    maxAlternatives?: number;
  },
): Promise<ItineraryPlanResult> {
  const key = tomtomKey();
  if (!key) {
    return {
      ok: false,
      mode,
      options: [],
      selectedIndex: 0,
      engine: 'none',
      error: 'no-key',
      label: 'TomTom clé manquante',
    };
  }

  const vias = (opts?.waypoints ?? [])
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .slice(0, 6);
  const locations = [from, ...vias, to]
    .map((p) => `${p.lat},${p.lon}`)
    .join(':');

  const params = new URLSearchParams();
  params.set('key', key);
  params.set('traffic', 'true');
  params.set('travelMode', mode === 'camion' ? 'truck' : 'car');
  params.set('routeType', avoid.eco ? 'eco' : 'fastest');
  params.set('maxAlternatives', String(Math.min(2, Math.max(0, opts?.maxAlternatives ?? 2))));
  params.append('sectionType', 'toll');
  params.append('sectionType', 'tollRoad');
  params.append('sectionType', 'ferry');
  params.append('sectionType', 'motorway');
  // Fuel model — enables fuelConsumptionInLiters when TomTom can compute it.
  if (mode === 'voiture') {
    params.set('constantSpeedConsumptionInLitersPerHundredkm', '50,6.5:80,8.0:100,9.5');
    params.set('currentFuelInLiters', '45');
    params.set('auxiliaryPowerInLitersPerHour', '0.4');
    params.set('fuelEnergyDensityInMJoulesPerLiter', '34.2');
  } else {
    params.set('constantSpeedConsumptionInLitersPerHundredkm', '50,28:80,32:100,36');
    params.set('currentFuelInLiters', '400');
    params.set('auxiliaryPowerInLitersPerHour', '1.2');
    params.set('fuelEnergyDensityInMJoulesPerLiter', '35.8');
    const t = opts?.truck;
    if (t?.heightM) params.set('vehicleHeight', String(t.heightM));
    if (t?.widthM) params.set('vehicleWidth', String(t.widthM));
    if (t?.lengthM) params.set('vehicleLength', String(t.lengthM));
    if (t?.weightT) params.set('vehicleWeight', String(Math.round(t.weightT * 1000)));
    if (t?.axleCount) params.set('vehicleAxleWeight', String(Math.round((t.axleLoadT ?? 8) * 1000)));
  }
  if (avoid.avoidTolls) params.append('avoid', 'tollRoads');
  if (avoid.avoidHighways) params.append('avoid', 'motorways');
  if (avoid.avoidFerries) params.append('avoid', 'ferries');

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${encodeURIComponent(locations)}/json?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    const raw = await res.text();
    let body: TomTomResponse | null = null;
    try {
      body = JSON.parse(raw) as TomTomResponse;
    } catch {
      body = null;
    }
    if (!res.ok || !body?.routes?.length) {
      const err =
        body?.detailedError?.message ||
        body?.error ||
        raw.slice(0, 160) ||
        `HTTP ${res.status}`;
      return {
        ok: false,
        mode,
        options: [],
        selectedIndex: 0,
        engine: 'tomtom',
        error: err,
        label: `TomTom KO — ${err}`,
      };
    }

    const options: ItineraryRouteOption[] = [];
    body.routes.slice(0, 3).forEach((r, i) => {
      const opt = routeToOption(r, mode, i, avoid, avoid.eco);
      if (opt) options.push(opt);
    });

    // If eco requested but only one route, try a parallel fastest for a 2nd option.
    if (avoid.eco && options.length < 2) {
      const fastParams = new URLSearchParams(params);
      fastParams.set('routeType', 'fastest');
      fastParams.set('maxAlternatives', '0');
      const fastUrl = `https://api.tomtom.com/routing/1/calculateRoute/${encodeURIComponent(locations)}/json?${fastParams.toString()}`;
      try {
        const fr = await fetch(fastUrl, {
          headers: { Accept: 'application/json', 'User-Agent': UA },
        });
        const fj = (await fr.json()) as TomTomResponse;
        const fr0 = fj.routes?.[0];
        if (fr0) {
          const extra = routeToOption(fr0, mode, 1, { ...avoid, eco: false }, false);
          if (extra && Math.abs(extra.distanceKm - options[0].distanceKm) > 0.3) {
            extra.title = 'Rapide';
            options.push(extra);
          }
        }
      } catch {
        /* keep single eco */
      }
    }

    if (!options.length) {
      return {
        ok: false,
        mode,
        options: [],
        selectedIndex: 0,
        engine: 'tomtom',
        error: 'empty',
        label: 'TomTom — aucun tracé',
      };
    }

    return {
      ok: true,
      mode,
      options,
      selectedIndex: 0,
      engine: 'tomtom',
      label: options[0].label,
    };
  } catch (e) {
    return {
      ok: false,
      mode,
      options: [],
      selectedIndex: 0,
      engine: 'tomtom',
      error: e instanceof Error ? e.message : 'network',
      label: 'TomTom réseau KO',
    };
  }
}
