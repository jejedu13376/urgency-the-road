/**
 * Extract Valhalla narrative maneuvers for TTS / turn list.
 * Soft-parses trip.legs[].maneuvers when present.
 */

export type RouteManeuver = {
  instruction: string;
  /** Distance along this maneuver (km). */
  lengthKm: number;
  /** Cumulative distance from route start to end of maneuver (km). */
  beginKm: number;
  type?: number;
  beginShapeIndex?: number;
  endShapeIndex?: number;
};

type RawManeuver = {
  instruction?: string;
  verbal_transition_alert_instruction?: string;
  verbal_pre_transition_instruction?: string;
  length?: number;
  type?: number;
  begin_shape_index?: number;
  end_shape_index?: number;
};

export function parseValhallaManeuvers(body: unknown): RouteManeuver[] {
  if (!body || typeof body !== 'object') return [];
  const trip = (body as { trip?: { legs?: { maneuvers?: RawManeuver[] }[] } }).trip;
  const maneuvers = trip?.legs?.[0]?.maneuvers;
  if (!Array.isArray(maneuvers)) return [];
  const out: RouteManeuver[] = [];
  let cursorKm = 0;
  for (const m of maneuvers) {
    const instruction = (
      m.verbal_pre_transition_instruction ||
      m.verbal_transition_alert_instruction ||
      m.instruction ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    const lengthKm =
      typeof m.length === 'number' && Number.isFinite(m.length) ? Math.max(0, m.length) : 0;
    if (!instruction && lengthKm <= 0) continue;
    out.push({
      instruction: instruction || 'Continuer',
      lengthKm,
      beginKm: cursorKm,
      type: typeof m.type === 'number' ? m.type : undefined,
      beginShapeIndex:
        typeof m.begin_shape_index === 'number' ? m.begin_shape_index : undefined,
      endShapeIndex: typeof m.end_shape_index === 'number' ? m.end_shape_index : undefined,
    });
    cursorKm += lengthKm;
  }
  return out;
}

/** Pick the next maneuver ahead of `progressKm` along the route. */
export function nextManeuverAt(
  maneuvers: RouteManeuver[],
  progressKm: number,
): RouteManeuver | null {
  if (!maneuvers.length) return null;
  for (const m of maneuvers) {
    const endKm = m.beginKm + m.lengthKm;
    if (progressKm < endKm - 0.02) return m;
  }
  return maneuvers[maneuvers.length - 1] ?? null;
}

/** Estimate progress along polyline by nearest vertex (km from start). */
export function estimateProgressKm(
  coords: [number, number][],
  lat: number,
  lon: number,
  haversineKm: (aLat: number, aLon: number, bLat: number, bLon: number) => number,
): number {
  if (coords.length < 2) return 0;
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineKm(lat, lon, coords[i][0], coords[i][1]);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  let km = 0;
  for (let i = 1; i <= bestI; i++) {
    km += haversineKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  }
  return km;
}
