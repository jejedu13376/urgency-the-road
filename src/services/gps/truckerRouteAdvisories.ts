/**
 * Max trucker route advisories — free/legal sources only.
 * Honest about missing live traffic / DOT closure feeds.
 */
import { haversineKm } from '../geo/deviceLocation';
import { fetchWeather, type WeatherSnapshot } from '../weather/openMeteo';
import {
  bridgePassForTruck,
  fetchNearbyBridgeClearances,
  fetchNearbyTruckDepots,
  fetchNearbyWeighStations,
  type BridgeClearance,
} from '../osm/overpassPlaces';
import type { GpsNavPrefs } from '../prefs/gpsNavPrefs';
import { overpassQueryRestFuel } from '../osm/truckerPois';

export type RouteAlertKind =
  | 'bridge'
  | 'weight'
  | 'height'
  | 'closure'
  | 'weather'
  | 'weigh'
  | 'fuel'
  | 'rest'
  | 'traffic'
  | 'profile';

export type RouteAlert = {
  id: string;
  kind: RouteAlertKind;
  /** Immediate overlay title (FR). */
  title: string;
  detail: string;
  /** Speak this when voice enabled. */
  voice?: string;
  severity: 'info' | 'warn' | 'critical';
  lat?: number;
  lon?: number;
  distanceKm?: number;
};

export type TruckerRouteBrief = {
  alerts: RouteAlert[];
  weather: WeatherSnapshot | null;
  fuelNearby: { id: string; name: string; lat: number; lon: number; distanceKm: number }[];
  restNearby: { id: string; name: string; lat: number; lon: number; distanceKm: number }[];
  bridgesNoPass: BridgeClearance[];
  label: string;
};

function profileAlerts(prefs: GpsNavPrefs): RouteAlert[] {
  if (prefs.mode !== 'camion') return [];
  const out: RouteAlert[] = [];
  const h = prefs.truckHeightM;
  const w = prefs.truckWidthM;
  const t = prefs.truckPtacT;
  out.push({
    id: 'profile-dims',
    kind: 'profile',
    title: 'Profil camion actif',
    detail: `Gabarit ${h.toFixed(2)} m · largeur ${w.toFixed(2)} m · PTAC ${t.toFixed(1)} t${
      prefs.hazmat ? ' · hazmat' : ''
    } — alertes vs OSM advisory (pas de graphe commercial).`,
    voice: `Profil camion: hauteur ${h.toFixed(1)} mètres, PTAC ${t.toFixed(0)} tonnes.`,
    severity: 'info',
  });
  if (h > 4.2) {
    out.push({
      id: 'profile-tall',
      kind: 'height',
      title: 'Hauteur élevée',
      detail: `Hauteur profil ${h.toFixed(2)} m — surveillez maxheight OSM / ponts bas.`,
      voice: `Attention hauteur ${h.toFixed(1)} mètres.`,
      severity: 'warn',
    });
  }
  if (t > 40) {
    out.push({
      id: 'profile-heavy',
      kind: 'weight',
      title: 'PTAC élevé',
      detail: `PTAC ${t.toFixed(1)} t — maxweight OSM advisory seulement.`,
      voice: `Attention poids ${t.toFixed(0)} tonnes.`,
      severity: 'warn',
    });
  }
  return out;
}

function weatherAlerts(w: WeatherSnapshot | null, lat: number, lon: number): RouteAlert[] {
  if (!w) return [];
  if (w.road === 'glacees') {
    return [
      {
        id: 'wx-ice',
        kind: 'weather',
        title: 'Routes glacées',
        detail: `${w.label} · ${w.tempC}°C — conditions glissantes (Open-Meteo).`,
        voice: `Attention, routes glacées. Température ${w.tempC} degrés.`,
        severity: 'critical',
        lat,
        lon,
      },
    ];
  }
  if (w.road === 'fermees') {
    return [
      {
        id: 'wx-closed',
        kind: 'closure',
        title: 'Conditions sévères',
        detail: `${w.label} · code orage/extrême — pas de feed fermeture DOT live.`,
        voice: 'Attention, conditions météo sévères sur le parcours.',
        severity: 'critical',
        lat,
        lon,
      },
    ];
  }
  return [
    {
      id: 'wx-ok',
      kind: 'weather',
      title: `Météo ${w.tempC}°C`,
      detail: `${w.label} · routes ${w.road} (pas de trafic live Google/Waze).`,
      severity: 'info',
      lat,
      lon,
    },
  ];
}

function bridgeAlerts(
  bridges: BridgeClearance[],
  prefs: GpsNavPrefs,
): RouteAlert[] {
  const out: RouteAlert[] = [];
  for (const b of bridges) {
    if (b.pass !== 'no') continue;
    const bits: string[] = [];
    if (b.maxheightM != null) bits.push(`maxheight ${b.maxheightM} m`);
    if (b.maxweightT != null) bits.push(`maxweight ${b.maxweightT} t`);
    const detail = `${b.name} · ${bits.join(' · ') || 'restriction'} vs profil ${prefs.truckHeightM} m / ${prefs.truckPtacT} t · ~${b.distanceKm} km`;
    out.push({
      id: `bridge-${b.id}`,
      kind: b.maxheightM != null && prefs.truckHeightM > (b.maxheightM ?? 99) ? 'height' : 'bridge',
      title: 'Pont / gabarit NO-PASS',
      detail,
      voice: `Attention, ouvrage trop bas ou trop léger à ${b.distanceKm} kilomètres. ${b.name}.`,
      severity: 'critical',
      lat: b.lat,
      lon: b.lon,
      distanceKm: b.distanceKm,
    });
  }
  return out.slice(0, 6);
}

/**
 * Build a trucker brief around live GPS. Traffic/closures: honest soft notes (no free global feed).
 */
export async function buildTruckerRouteBrief(
  lat: number,
  lon: number,
  prefs: GpsNavPrefs,
): Promise<TruckerRouteBrief> {
  const truck = {
    heightM: prefs.truckHeightM,
    weightT: prefs.truckPtacT,
    widthM: prefs.truckWidthM,
  };

  const [weather, bridges, weigh, pois] = await Promise.all([
    fetchWeather(lat, lon).catch(() => null),
    prefs.mode === 'camion'
      ? fetchNearbyBridgeClearances(lat, lon, 25000, truck)
      : Promise.resolve({ ok: true, bridges: [] as BridgeClearance[], label: '' }),
    fetchNearbyWeighStations(lat, lon, 40000),
    overpassQueryRestFuel(lat, lon, 35000).catch(() => ({
      fuel: [] as { id: string; name: string; lat: number; lon: number }[],
      rest: [] as { id: string; name: string; lat: number; lon: number }[],
      label: 'POI KO',
    })),
  ]);

  // Touch depots soft (fuel HGV) — merge into fuel list if Overpass POI thin.
  const depots =
    prefs.mode === 'camion'
      ? await fetchNearbyTruckDepots(lat, lon, 30000).catch(() => null)
      : null;

  const fuelNearby = [
    ...pois.fuel.map((p) => ({
      ...p,
      distanceKm: Math.round(haversineKm(lat, lon, p.lat, p.lon) * 10) / 10,
    })),
    ...((depots?.depots ?? [])
      .filter((d) => /fuel|diesel|station|relais/i.test(d.name) || d.kind === 'depot_pl')
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        name: d.name,
        lat: d.lat,
        lon: d.lon,
        distanceKm: Math.round(haversineKm(lat, lon, d.lat, d.lon) * 10) / 10,
      })) ?? []),
  ]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);

  const restNearby = pois.rest
    .map((p) => ({
      ...p,
      distanceKm: Math.round(haversineKm(lat, lon, p.lat, p.lon) * 10) / 10,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);

  const bridgesList = bridges.bridges ?? [];
  // Re-check pass against profile (defensive).
  const bridgesNoPass = bridgesList.filter((b) => {
    const pass =
      b.pass ??
      bridgePassForTruck(
        { maxheightM: b.maxheightM, maxweightT: b.maxweightT },
        { heightM: prefs.truckHeightM, weightT: prefs.truckPtacT },
      );
    return pass === 'no';
  });

  const alerts: RouteAlert[] = [
    ...profileAlerts(prefs),
    ...weatherAlerts(weather, lat, lon),
    ...bridgeAlerts(bridgesNoPass.length ? bridgesNoPass : bridgesList.filter((b) => b.pass === 'no'), prefs),
    {
      id: 'traffic-honest',
      kind: 'traffic',
      title: 'Trafic carte vs ETA',
      detail:
        'Couche Trafic (menu +) = TomTom flow ou Mapbox traffic-day si clé. ETA Valhalla reste sans congestion live — pas d’API Waze/Google gratuite.',
      severity: 'info',
    },
  ];

  if (weigh.stations?.[0]) {
    const s = weigh.stations[0];
    const d = Math.round(haversineKm(lat, lon, s.lat, s.lon) * 10) / 10;
    if (d <= 5) {
      alerts.push({
        id: `weigh-near-${s.id}`,
        kind: 'weigh',
        title: `Balance à ${d} km`,
        detail: `${s.name} · OSM weigh_station / weighbridge (CA/US/EU) · ${s.status}`,
        voice: `Balance à ${d} kilomètres.`,
        severity: d <= 3 ? 'warn' : 'info',
        lat: s.lat,
        lon: s.lon,
        distanceKm: d,
      });
    }
  }

  if (fuelNearby[0] && prefs.mode === 'camion') {
    const f = fuelNearby[0];
    alerts.push({
      id: `fuel-${f.id}`,
      kind: 'fuel',
      title: `Carburant PL ~${f.distanceKm} km`,
      detail: `${f.name} · Overpass amenity=fuel/hgv / truck_stop`,
      severity: 'info',
      lat: f.lat,
      lon: f.lon,
      distanceKm: f.distanceKm,
    });
  }

  if (restNearby[0] && prefs.mode === 'camion') {
    const r = restNearby[0];
    alerts.push({
      id: `rest-${r.id}`,
      kind: 'rest',
      title: `Aire de repos ~${r.distanceKm} km`,
      detail: `${r.name} · Overpass highway=rest_area / services`,
      severity: 'info',
      lat: r.lat,
      lon: r.lon,
      distanceKm: r.distanceKm,
    });
  }

  const critical = alerts.filter((a) => a.severity === 'critical' || a.severity === 'warn');
  return {
    alerts,
    weather,
    fuelNearby,
    restNearby,
    bridgesNoPass,
    label:
      critical.length > 0
        ? `${critical.length} alerte(s) gabarit/météo — overlay immédiat`
        : `Brief camion OK · ${bridgesList.length} ouvrages OSM · météo ${weather?.tempC ?? '?'}°C`,
  };
}

/** Alerts that must interrupt nav UI immediately. */
export function interruptingAlerts(alerts: RouteAlert[]): RouteAlert[] {
  return alerts.filter(
    (a) =>
      a.severity === 'critical' ||
      a.severity === 'warn' ||
      a.kind === 'bridge' ||
      a.kind === 'height' ||
      a.kind === 'weight' ||
      a.kind === 'closure' ||
      a.kind === 'weigh',
  );
}
