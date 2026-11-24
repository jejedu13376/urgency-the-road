/**
 * Itinerary planner — TomTom first (alts / avoid / eco / fuel / tolls),
 * Valhalla FOSSGIS next, then OSRM for long-haul when Valhalla hits its
 * ~1500 km max-distance cap (AU / CA / US / EU cross-region).
 * Never invent a straight-line haversine "success" route.
 */
import type { GpsVehicleMode } from '../prefs/gpsNavPrefs';
import { fetchOsrmAlternatives } from './osrmRoute';
import { estimateFuelCost, estimateTollCost } from './routeCostEstimate';
import {
  DEFAULT_ROUTE_AVOID,
  fetchTomTomItinerary,
  isTomTomRoutingConfigured,
  type ItineraryPlanResult,
  type ItineraryRouteOption,
  type RouteAvoidOptions,
} from './tomtomRoute';
import {
  fetchVehicleRoute,
  isValhallaMaxDistanceError,
  type RoutePoint,
  type TruckDims,
  type VehicleRouteResult,
} from './valhallaRoute';

export type { ItineraryPlanResult, ItineraryRouteOption, RouteAvoidOptions };
export { DEFAULT_ROUTE_AVOID, isTomTomRoutingConfigured };

function vehicleToOption(
  route: VehicleRouteResult,
  title: string,
  id: string,
): ItineraryRouteOption | null {
  if (!route.ok || route.coords.length < 2) return null;
  const fuel = estimateFuelCost(route.distanceKm, route.mode);
  const toll = estimateTollCost(route.mode, { tollSectionKm: 0 });
  const source: ItineraryRouteOption['source'] =
    route.source === 'osrm'
      ? 'osrm'
      : route.source === 'valhalla-truck'
        ? 'valhalla-truck'
        : 'valhalla-auto';
  return {
    id,
    title,
    coords: route.coords,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    hasTolls: false,
    tollSectionKm: 0,
    tollCostCad: null,
    tollLabel: toll.label,
    fuelLiters: fuel.liters,
    fuelCostCad: fuel.costCad,
    fuelLabel: `Essence estimée · ${fuel.liters} L · ~${fuel.costCad.toFixed(2)} $`,
    source,
    label: `${title} · ${route.label}`,
  };
}

function distinctEnough(a: ItineraryRouteOption, b: ItineraryRouteOption): boolean {
  return (
    Math.abs(a.distanceKm - b.distanceKm) > 0.8 ||
    Math.abs(a.durationMin - b.durationMin) > 3
  );
}

async function fetchValhallaPlan(
  from: RoutePoint,
  to: RoutePoint,
  mode: GpsVehicleMode,
  avoid: RouteAvoidOptions,
  truck?: TruckDims,
  excludeLocations?: RoutePoint[],
  waypoints?: RoutePoint[],
): Promise<ItineraryPlanResult> {
  const wp = waypoints?.length ? waypoints : undefined;
  const base = await fetchVehicleRoute(from, to, mode, truck, {
    excludeLocations,
    avoid: {
      avoidTolls: avoid.avoidTolls,
      avoidHighways: avoid.avoidHighways,
      avoidFerries: avoid.avoidFerries,
      eco: avoid.eco,
      waypoints: wp,
    },
  });

  const options: ItineraryRouteOption[] = [];
  const primary = vehicleToOption(
    base,
    avoid.eco ? 'Éco' : avoid.avoidTolls ? 'Sans péage' : 'Rapide',
    'valhalla-0',
  );
  if (primary) options.push(primary);

  // Soft alternatives when primary succeeded — different avoid mixes.
  if (base.ok) {
    const altSpecs: { title: string; patch: Partial<RouteAvoidOptions> }[] = [];
    if (!avoid.avoidTolls) {
      altSpecs.push({ title: 'Sans péage', patch: { avoidTolls: true } });
    }
    if (!avoid.avoidHighways) {
      altSpecs.push({ title: 'Sans autoroute', patch: { avoidHighways: true } });
    }
    if (!avoid.eco) {
      altSpecs.push({ title: 'Éco', patch: { eco: true } });
    }
    for (const spec of altSpecs) {
      if (options.length >= 3) break;
      const altAvoid = { ...avoid, ...spec.patch };
      const alt = await fetchVehicleRoute(from, to, mode, truck, {
        excludeLocations,
        avoid: {
          avoidTolls: altAvoid.avoidTolls,
          avoidHighways: altAvoid.avoidHighways,
          avoidFerries: altAvoid.avoidFerries,
          eco: altAvoid.eco,
          waypoints: wp,
        },
      });
      const opt = vehicleToOption(alt, spec.title, `valhalla-${options.length}`);
      if (opt && options.every((o) => distinctEnough(o, opt))) {
        options.push(opt);
      }
    }
  }

  if (!options.length) {
    return {
      ok: false,
      mode,
      options: [],
      selectedIndex: 0,
      engine: 'valhalla',
      error: base.error ?? 'empty',
      label: base.label || 'Valhalla KO',
    };
  }

  return {
    ok: true,
    mode,
    options,
    selectedIndex: 0,
    engine: 'valhalla',
    label: options[0].label,
  };
}

async function fetchOsrmPlan(
  from: RoutePoint,
  to: RoutePoint,
  mode: GpsVehicleMode,
  waypoints?: RoutePoint[],
): Promise<ItineraryPlanResult> {
  const routes = await fetchOsrmAlternatives(from, to, mode, { waypoints });
  const options: ItineraryRouteOption[] = [];
  const titles = ['Rapide', 'Autre', 'Option 3'];
  routes.forEach((r, i) => {
    const opt = vehicleToOption(r, titles[i] ?? `Option ${i + 1}`, `osrm-${i}`);
    if (opt && options.every((o) => distinctEnough(o, opt))) options.push(opt);
  });

  if (!options.length) {
    const err = routes[0]?.error ?? routes[0]?.label ?? 'OSRM KO';
    return {
      ok: false,
      mode,
      options: [],
      selectedIndex: 0,
      engine: 'osrm',
      error: err,
      label: routes[0]?.label || 'OSRM KO',
    };
  }

  return {
    ok: true,
    mode,
    options,
    selectedIndex: 0,
    engine: 'osrm',
    label: options[0].label,
  };
}

export type PlanItineraryInput = {
  from: RoutePoint;
  to: RoutePoint;
  mode: GpsVehicleMode;
  avoid?: RouteAvoidOptions;
  waypoints?: RoutePoint[];
  truck?: TruckDims;
  excludeLocations?: RoutePoint[];
};

/**
 * Prefer TomTom when key present; Valhalla otherwise; OSRM for long-haul
 * when Valhalla refuses (max distance) or fails.
 * Returns 1–3 route options with real road polylines — never haversine fakes.
 */
export async function planItinerary(
  input: PlanItineraryInput,
): Promise<ItineraryPlanResult> {
  const avoid = input.avoid ?? DEFAULT_ROUTE_AVOID;
  const waypoints = (input.waypoints ?? [])
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .slice(0, 6);

  if (isTomTomRoutingConfigured()) {
    const tt = await fetchTomTomItinerary(input.from, input.to, input.mode, avoid, {
      waypoints,
      truck: input.truck,
      maxAlternatives: 2,
    });
    if (tt.ok && tt.options.length) return tt;
    // Fall through — honest Valhalla / OSRM backup.
  }

  const result = await fetchValhallaPlan(
    input.from,
    input.to,
    input.mode,
    avoid,
    input.truck,
    input.excludeLocations,
    waypoints,
  );

  if (result.ok && result.options.length) return result;

  // Long-haul / Valhalla cap / network — OSRM public driving graph (worldwide OSM).
  const osrm = await fetchOsrmPlan(input.from, input.to, input.mode, waypoints);
  if (osrm.ok && osrm.options.length) {
    const reason = isValhallaMaxDistanceError(result.error)
      ? 'Valhalla max distance'
      : result.label || 'Valhalla KO';
    return {
      ...osrm,
      label: `${osrm.label} · secours (${reason})`,
    };
  }

  if (isTomTomRoutingConfigured()) {
    return {
      ...osrm,
      ok: false,
      label: `TomTom + Valhalla + OSRM KO — ${osrm.label}`,
    };
  }

  return {
    ...osrm,
    ok: false,
    label: `Valhalla + OSRM KO — ${osrm.label}`,
  };
}

/** Map a selected itinerary option onto the legacy VehicleRouteResult shape for inject/nav. */
export function itineraryOptionToVehicleRoute(
  opt: ItineraryRouteOption,
  mode: GpsVehicleMode,
): VehicleRouteResult {
  const source: VehicleRouteResult['source'] =
    opt.source === 'tomtom'
      ? mode === 'camion'
        ? 'valhalla-truck'
        : 'valhalla-auto'
      : opt.source === 'osrm'
        ? 'osrm'
        : opt.source;
  return {
    ok: true,
    mode,
    coords: opt.coords,
    distanceKm: opt.distanceKm,
    durationMin: opt.durationMin,
    source,
    label: opt.label,
  };
}
