import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView as RNWebView, type WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../../context/AuthContext';
import { useFleet } from '../../context/FleetContext';
import { getDeviceCoords, haversineKm, watchDevicePosition } from '../../services/geo/deviceLocation';
import {
  fetchPlacesAutocomplete,
  isGooglePlacesConfigured,
  newPlacesSessionToken,
  resolvePlaceCoords,
  type PlacesSuggestion,
} from '../../services/geo/googlePlacesAutocomplete';
import { geocodePlace } from '../../services/geo/openMeteoGeocode';
import {
  aqiFillColor,
  fetchAirQualityNear,
} from '../../services/geo/openWeatherAirQuality';
import {
  fetchVehicleRoute,
  type VehicleRouteResult,
} from '../../services/geo/valhallaRoute';
import { listRoadHazards, reportHazard } from '../../services/firebase/hazardsService';
import {
  estimateProgressKm,
  upcomingTurnAt,
} from '../../services/gps/routeManeuvers';
import {
  loadNavSpeechMuted,
  setNavSpeechMuted,
  speakArrival,
  speakNav,
  speakUpcomingTurn,
  stopNavSpeech,
} from '../../services/gps/navSpeech';
import {
  buildTruckerRouteBrief,
  interruptingAlerts,
  type RouteAlert,
} from '../../services/gps/truckerRouteAdvisories';
import {
  fetchNearbyBridgeClearances,
  fetchNearbyWeighStations,
} from '../../services/osm/overpassPlaces';
import {
  addCrowdReport,
  loadCrowdReports,
  mergeCloudHazards,
  type CrowdReport,
} from '../../services/prefs/gpsCrowdReports';
import {
  loadGpsNavPrefs,
  saveGpsNavPrefs,
  type GpsNavPrefs,
  type GpsVehicleMode,
} from '../../services/prefs/gpsNavPrefs';
import { findSavedPlace, savePlace } from '../../services/prefs/gpsSavedPlaces';
import {
  completeTrip,
  loadTripHistory,
  recordTripStart,
  type GpsTripRecord,
} from '../../services/prefs/gpsTripHistory';
import { colors } from '../../theme/colors';
import { buildGpsMapHtml } from './buildGpsMapHtml';
import {
  GpsDestinationMenu,
  type GpsDestinationSelection,
  type GpsRouteStatus,
} from './GpsDestinationMenu';
import { GpsRouteAlertOverlay } from './GpsRouteAlertOverlay';
import { GpsStreetViewModal } from './GpsStreetViewModal';
import { GpsTripTimeline } from './GpsTripTimeline';

/** RN WebView prop intersection can collapse to `never` under strict TS — cast for SDK 58. */
type WebViewHandle = {
  injectJavaScript: (script: string) => void;
};
const MapWebView = RNWebView as unknown as React.ComponentType<{
  ref?: React.Ref<WebViewHandle | null>;
  originWhitelist?: string[];
  source?: { html: string; baseUrl?: string };
  style?: object;
  onMessage?: (ev: WebViewMessageEvent) => void;
  onShouldStartLoadWithRequest?: (req: { url: string }) => boolean;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  allowFileAccess?: boolean;
  allowUniversalAccessFromFileURLs?: boolean;
  mixedContentMode?: string;
  setSupportMultipleWindows?: boolean;
  geolocationEnabled?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
}>;

const ALLOWED_MSG_TYPES = new Set([
  'ready',
  'mode',
  'route',
  'routed',
  'navigating',
  'arrived',
  'recenter',
  'streetview',
  'aqi_request',
  'maptype',
]);

/** Clearance under map HUD for SOS FAB (~bottom 92 + 58) + tab bar. */
const SOS_FAB_CLEARANCE = 110;

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

type MapMsg =
  | { type: 'ready'; mode: GpsVehicleMode }
  | { type: 'mode'; mode: GpsVehicleMode }
  | {
      type: 'route';
      mode: GpsVehicleMode;
      from: { lat: number; lon: number };
      to: { lat: number; lon: number };
      truck: { heightM: number; widthM: number; weightT: number };
    }
  | { type: 'routed'; mode: GpsVehicleMode; distanceKm?: number; durationMin?: number; label?: string }
  | { type: 'navigating'; mode: GpsVehicleMode; to: { lat: number; lon: number } }
  | { type: 'arrived'; mode: GpsVehicleMode; to: { lat: number; lon: number } }
  | { type: 'recenter' }
  | { type: 'streetview'; lat: number; lon: number }
  | { type: 'aqi_request'; lat: number; lon: number }
  | {
      type: 'maptype';
      base?: string;
      transit?: boolean;
      buildings3d?: boolean;
      aqi?: boolean;
    };

/** Parse + schema-check map postMessage payloads (reject forged / garbage). */
function parseMapMsg(raw: string): MapMsg | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const msg = parsed as Record<string, unknown>;
  if (typeof msg.type !== 'string' || !ALLOWED_MSG_TYPES.has(msg.type)) return null;

  if (msg.type === 'mode' || msg.type === 'ready' || msg.type === 'routed') {
    if (msg.mode !== 'voiture' && msg.mode !== 'camion') return null;
  }
  if (msg.type === 'route') {
    const from = msg.from as { lat?: unknown; lon?: unknown } | undefined;
    const to = msg.to as { lat?: unknown; lon?: unknown } | undefined;
    const truck = msg.truck as Record<string, unknown> | undefined;
    if (!from || !to || !truck) return null;
    if (!isFiniteCoord(from.lat) || !isFiniteCoord(from.lon)) return null;
    if (!isFiniteCoord(to.lat) || !isFiniteCoord(to.lon)) return null;
    if (msg.mode !== 'voiture' && msg.mode !== 'camion') return null;
  }
  if ((msg.type === 'navigating' || msg.type === 'arrived') && msg.to) {
    const to = msg.to as { lat?: unknown; lon?: unknown };
    if (!isFiniteCoord(to.lat) || !isFiniteCoord(to.lon)) return null;
    if (msg.mode !== 'voiture' && msg.mode !== 'camion') return null;
  }
  if (msg.type === 'streetview' || msg.type === 'aqi_request') {
    if (!isFiniteCoord(msg.lat) || !isFiniteCoord(msg.lon)) return null;
  }
  return msg as MapMsg;
}

/**
 * Keep WebView on the inline map document.
 * Resource loads (OSM tiles / unpkg) are not top-level navigations — block those URLs here.
 */
function allowMapDocumentLoad(url: string): boolean {
  if (!url || url === 'about:blank' || url === 'about:srcdoc') return true;
  if (url.startsWith('data:text/html')) return true;
  if (url === 'https://localhost/' || url === 'https://localhost') return true;
  return false;
}

/** One-shot GPS with hard timeout — permission prompts / hung getCurrentPosition must not block UI. */
async function getDeviceCoordsTimed(timeoutMs = 8000) {
  return Promise.race([
    getDeviceCoords({ allowFallback: false }),
    new Promise<{ ok: false; error: string }>((resolve) => {
      setTimeout(() => resolve({ ok: false, error: `GPS timeout (${timeoutMs / 1000}s)` }), timeoutMs);
    }),
  ]);
}

const MAP_ORIGIN_WHITELIST = ['about:blank', 'about:srcdoc', 'https://localhost'];

type MapWindow = Window & {
  postMessage: (message: unknown, targetOrigin: string) => void;
};

type ChromePads = {
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
};

function postGpsCmd(win: MapWindow | null, cmd: Record<string, unknown>) {
  if (!win) return;
  try {
    win.postMessage(JSON.stringify({ __gps: 1, ...cmd }), '*');
  } catch {
    /* ignore */
  }
}

/**
 * Full-bleed GPS map (OSM/Leaflet). Vehicle marker = LIVE device GPS.
 * Voiture/camion = top chips only. Tap / search = destination (no re-picker).
 * No Maps/Waze branding chips.
 */
export function GpsFullMap() {
  const insets = useSafeAreaInsets();
  const { active } = useFleet();
  const { profile } = useAuth();
  const webRef = useRef<WebViewHandle | null>(null);
  const iframeWinRef = useRef<MapWindow | null>(null);
  const routeReqId = useRef(0);
  const prefsRef = useRef<GpsNavPrefs | null>(null);
  const bootedRef = useRef(false);
  const fleetKeyRef = useRef<string | null>(null);
  const liveOriginRef = useRef<{ lat: number; lon: number } | null>(null);
  /** Last successful watchDevicePosition tick — preferred for recenter over one-shot. */
  const lastWatchRef = useRef<{ lat: number; lon: number } | null>(null);
  /** Booted on France overview — first live tick must setMapOrigin (pan+zoom), not only move marker. */
  const recoveryRecenterRef = useRef(false);
  /** Leaflet posted `ready` — setMapOrigin before this is dropped. */
  const mapReadyRef = useRef(false);
  const lastLayersRef = useRef<{
    bridges: unknown[];
    weigh: unknown[];
    reports: unknown[];
  } | null>(null);
  const reportsRef = useRef<CrowdReport[]>([]);
  /** Last local police pin — cloud publish only via explicit Publier. */
  const lastLocalPoliceRef = useRef<CrowdReport | null>(null);
  const [bootHtml, setBootHtml] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [canPublishPolice, setCanPublishPolice] = useState(false);
  const [hudNote, setHudNote] = useState<string | null>(null);
  const [lastRoute, setLastRoute] = useState<VehicleRouteResult | null>(null);
  const [modeLabel, setModeLabel] = useState<GpsVehicleMode>('voiture');
  const [gpsOk, setGpsOk] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<PlacesSuggestion[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const placesSessionRef = useRef(newPlacesSessionToken());
  const searchReqIdRef = useRef(0);
  const skipSuggestRef = useRef(false);
  const placesConfigured = isGooglePlacesConfigured();
  const [destSelection, setDestSelection] = useState<GpsDestinationSelection | null>(null);
  const [destMenuOpen, setDestMenuOpen] = useState(false);
  /** Post-trip CTA → voice logbook (carnet vocal). */
  const [tripEnded, setTripEnded] = useState<{
    lat: number;
    lon: number;
    mode: GpsVehicleMode;
    label?: string;
  } | null>(null);
  const destLabelRef = useRef<string | undefined>(undefined);
  const [tripHistory, setTripHistory] = useState<GpsTripRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [streetView, setStreetView] = useState<{ lat: number; lon: number } | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [activeAlert, setActiveAlert] = useState<RouteAlert | null>(null);
  const alertQueueRef = useRef<RouteAlert[]>([]);
  const shownAlertIdsRef = useRef<Set<string>>(new Set());
  const navigatingRef = useRef(false);
  const navDestRef = useRef<{ lat: number; lon: number } | null>(null);
  const activeTripIdRef = useRef<string | null>(null);
  const lastRouteRef = useRef<VehicleRouteResult | null>(null);
  const weighStationsRef = useRef<
    { id: string; name: string; lat: number; lon: number }[]
  >([]);
  /** Weigh stations already announced this nav session (by id). */
  const announcedWeighIdsRef = useRef<Set<string>>(new Set());
  /** Speak-once keys: `far-turn-N` / `near-turn-N` — never distance-dependent. */
  const spokenTurnBandsRef = useRef<Set<string>>(new Set());
  /** Last injectHighlightWeigh id — avoid rebuilding all markers every GPS tick. */
  const highlightedWeighIdRef = useRef<string | null>(null);
  const aqiOnRef = useRef(false);

  const enqueueAlerts = useCallback((alerts: RouteAlert[]) => {
    const interrupt = interruptingAlerts(alerts);
    for (const a of interrupt) {
      if (shownAlertIdsRef.current.has(a.id)) continue;
      shownAlertIdsRef.current.add(a.id);
      alertQueueRef.current.push(a);
    }
    setActiveAlert((cur) => {
      if (cur) return cur;
      return alertQueueRef.current.shift() ?? null;
    });
  }, []);

  const dismissAlert = useCallback(() => {
    setActiveAlert(alertQueueRef.current.shift() ?? null);
  }, []);

  const chromePads = useMemo<ChromePads>(
    () => ({
      padTop: Math.max(insets.top, 8) + 4,
      padRight: Math.max(insets.right, 8),
      padBottom: Math.max(insets.bottom, 8) + SOS_FAB_CLEARANCE,
      padLeft: Math.max(insets.left, 8),
    }),
    [insets.top, insets.right, insets.bottom, insets.left],
  );

  const injectJs = useCallback((script: string) => {
    if (Platform.OS === 'web') return;
    webRef.current?.injectJavaScript(`${script}; true;`);
  }, []);

  const injectRoute = useCallback(
    (result: VehicleRouteResult) => {
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'applyRoute', payload: result });
        return;
      }
      injectJs(`window.__gpsApplyRoute && window.__gpsApplyRoute(${JSON.stringify(result)})`);
    },
    [injectJs],
  );

  const injectLivePosition = useCallback(
    (lat: number, lon: number, ok: boolean, heading: number | null, speed: number | null) => {
      liveOriginRef.current = { lat, lon };
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, {
          cmd: 'updatePosition',
          lat,
          lon,
          ok,
          heading,
          speed,
        });
        return;
      }
      injectJs(
        `window.__gpsUpdatePosition && window.__gpsUpdatePosition(${lat},${lon},${ok ? 'true' : 'false'},${
          heading == null ? 'null' : heading
        },${speed == null ? 'null' : speed})`,
      );
    },
    [injectJs],
  );

  const setMapOrigin = useCallback(
    (lat: number, lon: number, ok: boolean) => {
      liveOriginRef.current = { lat, lon };
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'setOrigin', lat, lon, ok });
        return;
      }
      injectJs(
        `window.__gpsSetOrigin && window.__gpsSetOrigin(${lat},${lon},${ok ? 'true' : 'false'})`,
      );
    },
    [injectJs],
  );

  const applyModeInMap = useCallback(
    (mode: GpsVehicleMode, prefs: GpsNavPrefs) => {
      const truck = {
        heightM: prefs.truckHeightM,
        widthM: prefs.truckWidthM,
        weightT: prefs.truckPtacT,
      };
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'applyMode', mode, truck });
        return;
      }
      injectJs(
        `window.__gpsApplyMode && window.__gpsApplyMode(${JSON.stringify(mode)}, ${JSON.stringify(truck)})`,
      );
    },
    [injectJs],
  );

  const injectLayers = useCallback(
    (payload: {
      bridges: unknown[];
      weigh: unknown[];
      reports: unknown[];
    }) => {
      lastLayersRef.current = payload;
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'setLayers', payload });
        return;
      }
      injectJs(`window.__gpsSetLayers && window.__gpsSetLayers(${JSON.stringify(payload)})`);
    },
    [injectJs],
  );

  const proposeDestination = useCallback(
    (lat: number, lon: number, label: string) => {
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'proposeDestination', lat, lon, label });
        return;
      }
      injectJs(
        `window.__gpsProposeDestination && window.__gpsProposeDestination(${lat},${lon},${JSON.stringify(label)})`,
      );
    },
    [injectJs],
  );

  const startNavigation = useCallback(() => {
    if (Platform.OS === 'web') {
      postGpsCmd(iframeWinRef.current, { cmd: 'startNavigation' });
      return;
    }
    injectJs(`window.__gpsStartNavigation && window.__gpsStartNavigation()`);
  }, [injectJs]);

  const injectAqi = useCallback(
    (payload: { samples: { lat: number; lon: number; aqi: number; label: string; color: string }[] }) => {
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'setAqi', payload });
        return;
      }
      injectJs(`window.__gpsSetAqi && window.__gpsSetAqi(${JSON.stringify(payload)})`);
    },
    [injectJs],
  );

  const injectHighlightWeigh = useCallback(
    (id: string | null) => {
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'highlightWeigh', id });
        return;
      }
      injectJs(
        `window.__gpsHighlightWeigh && window.__gpsHighlightWeigh(${id == null ? 'null' : JSON.stringify(id)})`,
      );
    },
    [injectJs],
  );

  const refreshLayers = useCallback(async () => {
    // Overpass around a real device fix only — never France overview centroid.
    const origin = lastWatchRef.current ?? (gpsOk ? liveOriginRef.current : null);
    if (!origin || !bootHtml || !gpsOk) return;
    const prefs = prefsRef.current ?? (await loadGpsNavPrefs());
    const truck = { heightM: prefs.truckHeightM, weightT: prefs.truckPtacT };
    const [bridges, weigh, localReports, cloudHazards] = await Promise.all([
      fetchNearbyBridgeClearances(origin.lat, origin.lon, 18000, truck),
      fetchNearbyWeighStations(origin.lat, origin.lon, 60000),
      loadCrowdReports(),
      listRoadHazards(),
    ]);
    // Display may merge cloud pins; Valhalla excludes use LOCAL only (see route handler).
    const reports = mergeCloudHazards(localReports, cloudHazards.data ?? []);
    reportsRef.current = reports;
    weighStationsRef.current = (weigh.stations ?? []).slice(0, 30).map((s) => ({
      id: s.id,
      name: String(s.name ?? '').slice(0, 80),
      lat: s.lat,
      lon: s.lon,
    }));
    injectLayers({
      bridges: bridges.bridges.map((b) => ({
        ...b,
        name: String(b.name ?? '').slice(0, 80),
      })),
      weigh: weighStationsRef.current.map((s) => {
        const full = (weigh.stations ?? []).find((w) => w.id === s.id);
        return {
          id: s.id,
          name: s.name,
          lat: s.lat,
          lon: s.lon,
          status: full?.status,
          litUp: full?.litUp,
        };
      }),
      reports: reports.map((r) => ({
        id: r.id,
        kind: r.kind,
        lat: r.lat,
        lon: r.lon,
        // Strip markup before map HTML — defense in depth vs tooltip XSS.
        note: r.note ? r.note.replace(/[<>&"'`]/g, '').slice(0, 80) : undefined,
        source: r.source,
      })),
    });
    const bits = [bridges.label, weigh.label].filter(Boolean);
    if (bits.length) setHudNote((prev) => prev ?? bits[0]);
  }, [bootHtml, gpsOk, injectLayers]);

  const runTruckerBrief = useCallback(
    async (lat: number, lon: number) => {
      const prefs = prefsRef.current ?? (await loadGpsNavPrefs());
      const brief = await buildTruckerRouteBrief(lat, lon, prefs);
      setHudNote(brief.label);
      enqueueAlerts(brief.alerts);
    },
    [enqueueAlerts],
  );

  const refreshAqi = useCallback(
    async (lat: number, lon: number) => {
      if (!aqiOnRef.current) return;
      const res = await fetchAirQualityNear(lat, lon);
      if (!res.ok) {
        setHudNote(res.label);
        return;
      }
      injectAqi({
        samples: res.samples.map((s) => ({
          lat: s.lat,
          lon: s.lon,
          aqi: s.aqi,
          label: s.label,
          color: aqiFillColor(s.aqi),
        })),
      });
      setHudNote(res.label);
    },
    [injectAqi],
  );

  /** Boot map once — never remount on vehicle class / GPS ticks. */
  useEffect(() => {
    if (bootedRef.current) return;
    let cancelled = false;
    void (async () => {
      const stored = await loadGpsNavPrefs();
      const isPl =
        active?.vehicleClass === 'poids_lourd' || active?.powertrain === 'poids_lourd_diesel';
      const initial =
        stored.updatedAt === new Date(0).toISOString() && isPl
          ? await saveGpsNavPrefs({ mode: 'camion' })
          : stored;

      // Never block Carte forever on a hung getCurrentPosition (web / Expo Go).
      // Timeout must NOT clobber a live watch fix that arrived during the wait.
      const loc = await getDeviceCoordsTimed(8000);
      if (cancelled) return;

      const watchFix = lastWatchRef.current;
      const oneShotOk = loc.ok === true && loc.data?.source === 'device';
      const deviceOk = !!watchFix || oneShotOk;
      const origin = watchFix
        ? watchFix
        : oneShotOk
          ? { lat: loc.data.lat, lon: loc.data.lon }
          : { lat: 46.5, lon: 2.5 };

      prefsRef.current = initial;
      liveOriginRef.current = origin;
      setModeLabel(initial.mode);
      setGpsOk(deviceOk);
      // France / failed boot → first live tick must pan+zoom (setMapOrigin), not marker-only.
      recoveryRecenterRef.current = !deviceOk;
      if (!deviceOk) {
        setHudNote(
          loc.ok === false
            ? `GPS appareil refusé — ${loc.error}. Activez la localisation.`
            : 'GPS appareil requis — autorisez la localisation.',
        );
      }
      bootedRef.current = true;
      const mapboxToken = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '').trim();
      setBootHtml(
        buildGpsMapHtml({
          lat: origin.lat,
          lon: origin.lon,
          mode: initial.mode,
          truckHeightM: initial.truckHeightM,
          truckWidthM: initial.truckWidthM,
          truckPtacT: initial.truckPtacT,
          gpsOk: deviceOk,
          mapboxToken: mapboxToken || undefined,
          ...chromePads,
        }),
      );
      void loadNavSpeechMuted().then(setVoiceMuted);
      void loadTripHistory().then(setTripHistory);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Continuous LIVE GPS while Carte / GPS screen is focused — inject ticks, no remount. */
  useFocusEffect(
    useCallback(() => {
      let sub: { remove: () => void } | null = null;
      let cancelled = false;
      void (async () => {
        const next = await watchDevicePosition(
          (pos) => {
            if (cancelled) return;
            lastWatchRef.current = { lat: pos.lat, lon: pos.lon };
            setGpsOk(true);
            // Clear boot timeout / permission refusal once live GPS is real.
            setHudNote((prev) =>
              prev && /GPS appareil|GPS timeout|localisation/i.test(prev) ? null : prev,
            );
            if (recoveryRecenterRef.current) {
              // Left France overview — pan+zoom once the map document is ready.
              // Clearing the flag before ready drops setMapOrigin (iframe/WebView).
              if (mapReadyRef.current) {
                recoveryRecenterRef.current = false;
                setMapOrigin(pos.lat, pos.lon, true);
                return;
              }
              // Keep recovery flag; `ready` handler will setMapOrigin from lastWatchRef.
              injectLivePosition(pos.lat, pos.lon, true, pos.headingDeg, pos.speedMps);
              return;
            }
            injectLivePosition(pos.lat, pos.lon, true, pos.headingDeg, pos.speedMps);

            // During nav: weigh approach alerts + TTS turns — IMMEDIATE overlay, not passive.
            if (navigatingRef.current) {
              const dest = navDestRef.current;
              if (dest) {
                const toDestKm = haversineKm(pos.lat, pos.lon, dest.lat, dest.lon);
                // ~60 m arrival radius — complete trip history + stop nav TTS/alerts.
                if (toDestKm <= 0.06) {
                  // Sync clear before any async — HTML may also post `arrived`.
                  navigatingRef.current = false;
                  navDestRef.current = null;
                  shownAlertIdsRef.current = new Set();
                  highlightedWeighIdRef.current = null;
                  injectHighlightWeigh(null);
                  setHudNote('Arrivée — GPS live toujours actif');
                  speakArrival(
                    lastRouteRef.current?.durationMin,
                    lastRouteRef.current?.distanceKm,
                  );
                  const tripId = activeTripIdRef.current;
                  activeTripIdRef.current = null;
                  if (tripId) {
                    void completeTrip(tripId).then(() => {
                      void loadTripHistory().then(setTripHistory);
                    });
                  }
                  return;
                }
              }

              const route = lastRouteRef.current;
              if (route?.ok && route.maneuvers?.length) {
                const progressKm = estimateProgressKm(
                  route.coords,
                  pos.lat,
                  pos.lon,
                  haversineKm,
                );
                const next = upcomingTurnAt(route.maneuvers, progressKm);
                if (next) {
                  const remain = next.distanceKm;
                  const nearKey = `near-${next.key}`;
                  const farKey = `far-${next.key}`;
                  if (remain <= 0.8 && !spokenTurnBandsRef.current.has(nearKey)) {
                    spokenTurnBandsRef.current.add(nearKey);
                    spokenTurnBandsRef.current.add(farKey); // skip far if we enter near first
                    speakUpcomingTurn(next.instruction, remain);
                  } else if (
                    remain <= 2.5 &&
                    remain > 0.8 &&
                    !spokenTurnBandsRef.current.has(farKey)
                  ) {
                    spokenTurnBandsRef.current.add(farKey);
                    speakUpcomingTurn(next.instruction, remain);
                  }
                }
              }

              // Announce every distinct scale in range (no break after first).
              // Voice comes only from overlay (avoid double speak).
              let highlightId: string | null = null;
              let highlightDist = Infinity;
              for (const s of weighStationsRef.current) {
                const d = haversineKm(pos.lat, pos.lon, s.lat, s.lon);
                if (d > 3.2) continue;
                if (d < highlightDist) {
                  highlightDist = d;
                  highlightId = s.id;
                }
                if (announcedWeighIdsRef.current.has(s.id)) continue;
                announcedWeighIdsRef.current.add(s.id);
                const rounded = d <= 2.2 ? 2 : 3;
                enqueueAlerts([
                  {
                    id: `weigh-nav-${s.id}`,
                    kind: 'weigh',
                    title: `Balance à ${rounded} km`,
                    detail: `${s.name} · OSM weigh_station / weighbridge (CA/US/EU) — overlay immédiat`,
                    voice: `Attention, balance à ${rounded} kilomètres.`,
                    severity: 'warn',
                    lat: s.lat,
                    lon: s.lon,
                    distanceKm: Math.round(d * 10) / 10,
                  },
                ]);
              }
              // Only rebuild map pins when highlight target changes (incl. clear).
              if (highlightId !== highlightedWeighIdRef.current) {
                highlightedWeighIdRef.current = highlightId;
                injectHighlightWeigh(highlightId);
              }
            }
          },
          (err) => {
            if (cancelled) return;
            setGpsOk(false);
            // Keep map GPS state in sync — do not leave marker/routing as if live.
            // Never invent France centroid: keep last known origin + route graphics.
            const origin = lastWatchRef.current ?? liveOriginRef.current;
            if (origin) {
              injectLivePosition(origin.lat, origin.lon, false, null, null);
            }
            setHudNote(`GPS live — ${err}`);
          },
        );
        if (cancelled) {
          next?.remove();
          return;
        }
        sub = next;
      })();
      return () => {
        cancelled = true;
        sub?.remove();
      };
    }, [injectLivePosition, setMapOrigin, injectHighlightWeigh, enqueueAlerts]),
  );

  useEffect(() => {
    if (!bootHtml || !gpsOk || !mapReady) return;
    void refreshLayers();
    const t = setInterval(() => void refreshLayers(), 90_000);
    return () => clearInterval(t);
  }, [bootHtml, gpsOk, mapReady, modeLabel, refreshLayers]);

  useEffect(() => {
    if (!bootedRef.current || !bootHtml) return;
    const key = `${active?.vehicleClass ?? ''}|${active?.powertrain ?? ''}`;
    if (fleetKeyRef.current === null) {
      fleetKeyRef.current = key;
      return;
    }
    if (fleetKeyRef.current === key) return;
    fleetKeyRef.current = key;

    const isPl =
      active?.vehicleClass === 'poids_lourd' || active?.powertrain === 'poids_lourd_diesel';
    void (async () => {
      const prefs = prefsRef.current ?? (await loadGpsNavPrefs());
      const nextMode: GpsVehicleMode = prefs.mode;
      setModeLabel(nextMode);
      applyModeInMap(nextMode, prefs);
      setHudNote((prev) => {
        if (prev && /GPS appareil/i.test(prev)) return prev;
        if (isPl && nextMode === 'voiture') {
          return 'Véhicule PL — mode voiture conservé (choix enregistré)';
        }
        if (isPl && nextMode === 'camion') {
          return 'Véhicule PL actif — profil camion (carte conservée)';
        }
        return 'Profil véhicule mis à jour — carte conservée';
      });
    })();
  }, [active?.vehicleClass, active?.powertrain, bootHtml, applyModeInMap]);

  useEffect(() => {
    if (!bootHtml) return;
    if (Platform.OS === 'web') {
      postGpsCmd(iframeWinRef.current, { cmd: 'setChrome', pads: chromePads });
      return;
    }
    injectJs(`window.__gpsSetChrome && window.__gpsSetChrome(${JSON.stringify(chromePads)})`);
  }, [bootHtml, chromePads, injectJs]);

  const handleMapMsg = useCallback(
    (raw: string) => {
      const msg = parseMapMsg(raw);
      if (!msg) return;

      if (msg.type === 'ready') {
        mapReadyRef.current = true;
        setMapReady(true);
        if (msg.mode === 'voiture' || msg.mode === 'camion') setModeLabel(msg.mode);
        // Reinject any layers that raced before Leaflet boot — do NOT Overpass
        // around France overview; refreshLayers waits for real gpsOk.
        const cached = lastLayersRef.current;
        if (cached) injectLayers(cached);
        // Live GPS may have arrived before Leaflet ready — pan+zoom now.
        if (recoveryRecenterRef.current && lastWatchRef.current) {
          recoveryRecenterRef.current = false;
          setMapOrigin(lastWatchRef.current.lat, lastWatchRef.current.lon, true);
        }
        return;
      }

      if (msg.type === 'mode') {
        setModeLabel(msg.mode);
        void saveGpsNavPrefs({ mode: msg.mode }).then((p) => {
          prefsRef.current = p;
        });
        setHudNote(msg.mode === 'camion' ? 'Mode camion enregistré' : 'Mode voiture enregistré');
        return;
      }

      if (msg.type === 'recenter') {
        void (async () => {
          const loc = await getDeviceCoordsTimed(8000);
          const deviceOk = loc.ok === true && loc.data?.source === 'device';
          if (deviceOk) {
            lastWatchRef.current = { lat: loc.data.lat, lon: loc.data.lon };
            recoveryRecenterRef.current = false;
            setGpsOk(true);
            setHudNote('GPS appareil OK — suivi live');
            setMapOrigin(loc.data.lat, loc.data.lon, true);
            return;
          }
          // One-shot failed: only re-center as live if we already had a REAL watch fix.
          // Never promote France overview (boot fallback) to ok=true.
          const errTxt =
            loc.ok === false
              ? `GPS one-shot refusé — ${loc.error}`
              : 'GPS one-shot indisponible';
          const realWatch = lastWatchRef.current;
          if (realWatch) {
            setHudNote(`${errTxt} — recentrage sur dernière position live (itinéraire conservé)`);
            setMapOrigin(realWatch.lat, realWatch.lon, true);
            return;
          }
          setHudNote(`${errTxt} — pas encore de fix live · itinéraire conservé`);
        })();
        return;
      }

      if (msg.type === 'route') {
        if (!gpsOk) {
          setHudNote('Itinéraire bloqué — GPS appareil requis (pas de fallback Lille)');
          return;
        }
        setModeLabel(msg.mode);
        // Keep trip label in sync with map destination (map taps have no search label).
        setDestSelection((prev) => {
          const same =
            prev != null &&
            Math.abs(prev.lat - msg.to.lat) < 1e-5 &&
            Math.abs(prev.lon - msg.to.lon) < 1e-5;
          if (same) return prev;
          return {
            lat: msg.to.lat,
            lon: msg.to.lon,
            label: `${msg.to.lat.toFixed(5)}, ${msg.to.lon.toFixed(5)}`,
          };
        });
        const reqId = ++routeReqId.current;
        void (async () => {
          await saveGpsNavPrefs({
            mode: msg.mode,
            truckHeightM: msg.truck.heightM,
            truckWidthM: msg.truck.widthM,
            truckPtacT: msg.truck.weightT,
          }).then((p) => {
            prefsRef.current = p;
          });
          if (reqId !== routeReqId.current) return;

          const from = liveOriginRef.current ?? msg.from;
          // Soft-fail cloud excludes until Firestore rules validate kind/coords/expiry.
          // Only LOCAL crowd reports may steer Valhalla (device-authored, rate-limited).
          const excludes = reportsRef.current
            .filter(
              (r) =>
                r.source === 'local' &&
                (r.kind === 'police' || r.kind === 'accident' || r.kind === 'danger') &&
                Number.isFinite(r.lat) &&
                Number.isFinite(r.lon),
            )
            .slice(0, 8)
            .map((r) => ({ lat: r.lat, lon: r.lon }));

          const route = await fetchVehicleRoute(from, msg.to, msg.mode, {
            heightM: msg.truck.heightM,
            widthM: msg.truck.widthM,
            weightT: msg.truck.weightT,
          }, { excludeLocations: excludes });
          if (reqId !== routeReqId.current) return;
          // Bridge/weight/weather fire IMMEDIATE overlays via trucker brief (not passive HUD).
          // Reset alert dedupe for this new route so later trips still get overlays;
          // navigating must NOT clear again (avoids double-speak on Démarrer).
          shownAlertIdsRef.current = new Set();
          setLastRoute(route);
          lastRouteRef.current = route;
          setHudNote(route.label);
          injectRoute(route);
          void refreshLayers();
          const originPt = liveOriginRef.current ?? msg.from;
          void runTruckerBrief(originPt.lat, originPt.lon);
        })();
        return;
      }

      if (msg.type === 'navigating' && msg.to) {
        setTripEnded(null);
        navigatingRef.current = true;
        navDestRef.current = { lat: msg.to.lat, lon: msg.to.lon };
        // Reset per-nav speak/announce state — do NOT clear shownAlertIdsRef or
        // re-run trucker brief (route handler already queued overlays once).
        spokenTurnBandsRef.current = new Set();
        announcedWeighIdsRef.current = new Set();
        setHudNote(
          msg.mode === 'camion'
            ? 'Navigation camion — alertes gabarit/météo en overlay immédiat'
            : 'Navigation voiture — marqueur = GPS live',
        );
        const route = lastRouteRef.current;
        const originPt = liveOriginRef.current;
        if (route?.ok && originPt) {
          void recordTripStart({
            mode: msg.mode,
            origin: {
              lat: originPt.lat,
              lon: originPt.lon,
              label: 'Départ GPS',
            },
            destination: {
              lat: msg.to.lat,
              lon: msg.to.lon,
              label: destSelection?.label,
            },
            distanceKm: route.distanceKm,
            durationMin: route.durationMin,
            coords: route.coords,
          }).then((r) => {
            if (r.ok) {
              activeTripIdRef.current = r.trip.id;
              void loadTripHistory().then(setTripHistory);
            }
          });
          speakNav(
            msg.mode === 'camion'
              ? `Navigation camion démarrée. ${route.distanceKm} kilomètres, environ ${route.durationMin} minutes.`
              : `Navigation démarrée. ${route.distanceKm} kilomètres, environ ${route.durationMin} minutes.`,
          );
        }
        return;
      }

      if (msg.type === 'arrived' && msg.to) {
        // Idempotent — HTML + RN watch may both detect ~60–80 m arrival.
        if (!navigatingRef.current && !activeTripIdRef.current) return;
        navigatingRef.current = false;
        navDestRef.current = null;
        shownAlertIdsRef.current = new Set();
        highlightedWeighIdRef.current = null;
        injectHighlightWeigh(null);
        setTripEnded({
          lat: msg.to.lat,
          lon: msg.to.lon,
          mode: msg.mode,
          label: destLabelRef.current,
        });
        setHudNote('Arrivée — note vocale trajet dispo');
        speakArrival(lastRouteRef.current?.durationMin, lastRouteRef.current?.distanceKm);
        const tripId = activeTripIdRef.current;
        activeTripIdRef.current = null;
        if (tripId) {
          void completeTrip(tripId).then(() => {
            void loadTripHistory().then(setTripHistory);
          });
        }
        return;
      }

      if (msg.type === 'streetview') {
        setStreetView({ lat: msg.lat, lon: msg.lon });
        return;
      }

      if (msg.type === 'aqi_request') {
        aqiOnRef.current = true;
        void refreshAqi(msg.lat, msg.lon);
        return;
      }

      if (msg.type === 'maptype') {
        aqiOnRef.current = !!msg.aqi;
        if (msg.aqi && liveOriginRef.current) {
          void refreshAqi(liveOriginRef.current.lat, liveOriginRef.current.lon);
        }
      }
    },
    [
      gpsOk,
      injectRoute,
      setMapOrigin,
      refreshLayers,
      injectLayers,
      runTruckerBrief,
      destSelection?.label,
      injectHighlightWeigh,
      refreshAqi,
    ],
  );

  useEffect(() => {
    // Always mirror (including clear) so arrival never reuses a stale place name.
    destLabelRef.current = destSelection?.label;
  }, [destSelection]);

  const onMessage = useCallback(
    (ev: WebViewMessageEvent) => {
      handleMapMsg(ev.nativeEvent.data);
    },
    [handleMapMsg],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onWinMsg = (ev: MessageEvent) => {
      const mapWin = iframeWinRef.current;
      if (!mapWin || ev.source !== mapWin) return;
      if (ev.origin !== '' && ev.origin !== 'null' && ev.origin !== window.location.origin) return;
      if (typeof ev.data === 'string') handleMapMsg(ev.data);
    };
    window.addEventListener('message', onWinMsg);
    return () => window.removeEventListener('message', onWinMsg);
  }, [handleMapMsg]);

  const clearSearchHits = useCallback(() => {
    setSearchOpen(false);
    setSearchHits([]);
  }, []);

  /** Drop in-flight autocomplete without arming skipSuggest (safe on failed pick). */
  const invalidateInFlightSuggest = useCallback(() => {
    searchReqIdRef.current += 1;
    setSearchBusy(false);
    clearSearchHits();
  }, [clearSearchHits]);

  /** Fill the field after a confirmed destination — skip one suggest cycle for that setState. */
  const applyDestinationLabel = useCallback(
    (label: string) => {
      skipSuggestRef.current = true;
      searchReqIdRef.current += 1;
      clearSearchHits();
      setSearchQ(label);
    },
    [clearSearchHits],
  );

  /** Debounced live Google Places suggestions while typing. */
  useEffect(() => {
    if (skipSuggestRef.current) {
      skipSuggestRef.current = false;
      return;
    }
    const q = searchQ.trim();
    const reqId = ++searchReqIdRef.current;
    const timer = setTimeout(() => {
      void (async () => {
        if (reqId !== searchReqIdRef.current) return;
        if (!placesConfigured || q.length < 2) {
          setSearchOpen(false);
          setSearchHits([]);
          setSearchBusy(false);
          return;
        }
        setSearchBusy(true);
        try {
          const res = await fetchPlacesAutocomplete(q, placesSessionRef.current, {
            limit: 6,
          });
          if (reqId !== searchReqIdRef.current) return;
          setSearchHits(res.suggestions);
          setSearchOpen(res.suggestions.length > 0);
          if (!res.ok && res.error && q.length >= 3) {
            // Soft note only — keep typing uninterrupted.
            setHudNote(res.error);
          }
        } finally {
          if (reqId === searchReqIdRef.current) setSearchBusy(false);
        }
      })();
    }, 320);

    return () => clearTimeout(timer);
  }, [searchQ, placesConfigured]);

  /** Confirm a resolved place: fill search, open dest menu, center map. */
  const commitDestination = useCallback(
    (lat: number, lon: number, label: string, noteSuffix?: string) => {
      applyDestinationLabel(label);
      setDestSelection({ lat, lon, label });
      setLastRoute(null);
      proposeDestination(lat, lon, label);
      setDestMenuOpen(true);
      setHudNote(noteSuffix ? `Destination · ${label} · ${noteSuffix}` : `Destination · ${label}`);
      void (async () => {
        const saved = await findSavedPlace(lat, lon);
        if (!saved?.tag) return;
        setDestSelection((prev) =>
          prev && prev.lat === lat && prev.lon === lon ? { ...prev, tag: saved.tag } : prev,
        );
      })();
    },
    [applyDestinationLabel, proposeDestination],
  );

  /** Explicit OK: Places resolve if one hit, else Open-Meteo/Photon fallback. */
  const runSearch = useCallback(async () => {
    const q = searchQ.trim();
    if (!q) return;
    searchReqIdRef.current += 1;
    setSearchBusy(true);
    setSearchOpen(true);
    try {
      if (placesConfigured) {
        const res = await fetchPlacesAutocomplete(q, placesSessionRef.current, {
          limit: 6,
        });
        setSearchHits(res.suggestions);
        if (res.suggestions.length === 1) {
          const only = res.suggestions[0];
          const coords = await resolvePlaceCoords(only.placeId, placesSessionRef.current);
          placesSessionRef.current = newPlacesSessionToken();
          if (coords.ok && coords.lat != null && coords.lon != null) {
            commitDestination(coords.lat, coords.lon, coords.label ?? only.label);
            return;
          }
        }
        if (!res.ok) setHudNote(res.error ?? 'Adresse introuvable (Places)');
        else setHudNote(`${res.suggestions.length} suggestion(s) · google_places`);
        return;
      }

      const res = await geocodePlace(q, 6);
      if (res.ok && res.hits[0]) {
        const hit = res.hits[0];
        commitDestination(hit.lat, hit.lon, hit.label, res.source);
      } else {
        setSearchHits([]);
        setHudNote(
          res.error ??
            'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY manquant — géocode fallback KO',
        );
      }
    } finally {
      setSearchBusy(false);
    }
  }, [searchQ, placesConfigured, commitDestination]);

  const pickSearchHit = useCallback(
    (hit: PlacesSuggestion) => {
      void (async () => {
        invalidateInFlightSuggest();
        setSearchBusy(true);
        try {
          const coords = await resolvePlaceCoords(hit.placeId, placesSessionRef.current);
          placesSessionRef.current = newPlacesSessionToken();
          if (!coords.ok || coords.lat == null || coords.lon == null) {
            skipSuggestRef.current = false;
            setHudNote(coords.error ?? 'Place Details KO');
            return;
          }
          commitDestination(coords.lat, coords.lon, coords.label ?? hit.label);
        } finally {
          setSearchBusy(false);
        }
      })();
    },
    [invalidateInFlightSuggest, commitDestination],
  );

  const destRouteStatus: GpsRouteStatus = !lastRoute
    ? 'pending'
    : lastRoute.ok
      ? 'ready'
      : 'failed';

  /** One-tap Police = AsyncStorage local pin only — never auto-upload GPS/uid. */
  const dropPoliceReport = useCallback(() => {
    const origin = liveOriginRef.current;
    if (!origin || !gpsOk) {
      setHudNote('Signalement police — GPS appareil requis');
      return;
    }
    void (async () => {
      const local = await addCrowdReport({
        kind: 'police',
        lat: origin.lat,
        lon: origin.lon,
        note: 'Police (crowd local · expire ~45 min)',
      });
      if (!local.ok) {
        setHudNote(local.error);
        return;
      }
      lastLocalPoliceRef.current = local.report;
      setCanPublishPolice(true);
      setHudNote(
        profile?.uid
          ? 'Police local (~45 min) — tapez Publier pour cloud (login OK)'
          : 'Police local uniquement (~45 min) — pas d’envoi cloud (connectez-vous pour Publier)',
      );
      void refreshLayers();
    })();
  }, [gpsOk, profile?.uid, refreshLayers]);

  /** Explicit cloud publish — same gate as Module 7 GPS sheet (login + intentional). */
  const publishPoliceCloud = useCallback(() => {
    const pin = lastLocalPoliceRef.current;
    if (!pin) {
      setHudNote('Rien à publier — tapez Police d’abord (local)');
      return;
    }
    if (!profile?.uid) {
      setHudNote('Publier cloud — connexion requise');
      return;
    }
    void (async () => {
      const uid = profile.uid?.trim();
      if (!uid) {
        setHudNote('Publier cloud — uid manquant — pin reste local');
        return;
      }
      const r = await reportHazard({
        reporterUid: uid,
        kind: 'radar',
        lat: pin.lat,
        lon: pin.lon,
        note: pin.note ?? 'Police',
        expiresAt: pin.expiresAt,
      });
      // mockResult is ok:true + source:'mock' — must NOT claim cloud publish.
      const cloudLive = r.ok === true && r.source === 'firebase' && !!r.data;
      if (!cloudLive) {
        setHudNote(
          r.stubLabel ??
            'Publication non live (mock / Firebase off) — pin reste local · Publier toujours disponible',
        );
        // Keep Publier visible so the user can retry when cloud is real.
        return;
      }
      setCanPublishPolice(false);
      setHudNote('Police publié cloud (explicite) — pin local conservé');
      void refreshLayers();
    })();
  }, [profile, refreshLayers]);

  if (!bootHtml) {
    return (
      <View style={[styles.fill, styles.boot]}>
        <Text style={styles.bootTxt}>Chargement carte GPS…</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill} accessibilityLabel={`Carte GPS mode ${modeLabel}`}>
      {Platform.OS === 'web' ? (
        <WebIframe
          html={bootHtml}
          onReady={(win) => {
            iframeWinRef.current = win;
          }}
        />
      ) : (
        <MapWebView
          ref={webRef}
          originWhitelist={MAP_ORIGIN_WHITELIST}
          source={{
            html: bootHtml,
            baseUrl: 'https://localhost/',
          }}
          style={styles.fill}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(req) => allowMapDocumentLoad(req.url)}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          geolocationEnabled={false}
          mediaPlaybackRequiresUserAction
        />
      )}

      <View
        style={[
          styles.searchWrap,
          {
            top: chromePads.padTop + 58,
            left: chromePads.padLeft + 4,
            right: chromePads.padRight + 4,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.searchRow}>
          <TextInput
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder={
              placesConfigured ? 'Adresse / lieu…' : 'Adresse… (clé Places manquante)'
            }
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => void runSearch()}
            accessibilityLabel="Recherche adresse autocomplete"
            autoCorrect={false}
            autoCapitalize="none"
          />
          <Pressable style={styles.searchBtn} onPress={() => void runSearch()}>
            {searchBusy ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.searchBtnTxt}>OK</Text>
            )}
          </Pressable>
        </View>
        {searchOpen && searchHits.length > 0 ? (
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={searchHits}
            keyExtractor={(item) => item.placeId}
            style={styles.hits}
            renderItem={({ item }) => (
              <Pressable style={styles.hitRow} onPress={() => pickSearchHit(item)}>
                <Text style={styles.hitTxt} numberOfLines={1}>
                  {item.mainText || item.label}
                </Text>
                {item.secondaryText ? (
                  <Text style={styles.hitSub} numberOfLines={1}>
                    {item.secondaryText}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
        ) : null}
      </View>

      {/* Hide while search hits open — results FlatList must win all taps. */}
      {!(searchOpen && searchHits.length > 0) ? (
        <View
          style={[
            styles.reportRow,
            {
              top: chromePads.padTop + 108,
              left: chromePads.padLeft + 4,
              zIndex: 15,
              elevation: 15,
            },
          ]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.reportBtn} onPress={dropPoliceReport}>
            <Text style={styles.reportTxt}>Police</Text>
          </Pressable>
          {canPublishPolice ? (
            <Pressable style={styles.publishBtn} onPress={publishPoliceCloud}>
              <Text style={styles.reportTxt}>Publier</Text>
            </Pressable>
          ) : null}
          {lastRoute?.ok ? (
            <Text style={styles.etaTxt} numberOfLines={1}>
              ~{lastRoute.durationMin} min · {lastRoute.distanceKm} km
            </Text>
          ) : null}
          <Pressable
            style={styles.toolBtn}
            onPress={() => {
              const origin = lastWatchRef.current ?? liveOriginRef.current;
              if (!origin || !gpsOk) {
                setHudNote('Enregistrer le lieu — GPS appareil requis');
                return;
              }
              void savePlace({
                lat: origin.lat,
                lon: origin.lon,
                label: `Position ${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)}`,
              }).then((r) => {
                setHudNote(r.ok ? `Lieu GPS enregistré · ${r.place.label}` : r.error);
              });
            }}
            accessibilityLabel="Enregistrer le lieu"
          >
            <Text style={styles.reportTxt}>Sauver</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() => {
              void loadTripHistory().then((rows) => {
                setTripHistory(rows);
                setHistoryOpen(true);
              });
            }}
            accessibilityLabel="Voir l'historique"
          >
            <Text style={styles.reportTxt}>Histo</Text>
          </Pressable>
          <Pressable
            style={[styles.toolBtn, voiceMuted && styles.toolBtnMuted]}
            onPress={() => {
              const next = !voiceMuted;
              setVoiceMuted(next);
              void setNavSpeechMuted(next);
              if (next) stopNavSpeech();
              setHudNote(next ? 'Voix coupée' : 'Voix guidage activée');
            }}
            accessibilityLabel={voiceMuted ? 'Activer la voix' : 'Couper la voix'}
          >
            <Text style={styles.reportTxt}>{voiceMuted ? 'Mute' : 'Voix'}</Text>
          </Pressable>
        </View>
      ) : null}

      {hudNote ? (
        <View
          pointerEvents="none"
          style={[
            styles.note,
            {
              top: chromePads.padTop + 152,
              left: chromePads.padLeft + 4,
              right: chromePads.padRight + 4,
            },
          ]}
        >
          <Text style={styles.noteTxt} numberOfLines={3}>
            {hudNote}
          </Text>
        </View>
      ) : null}

      {tripEnded ? (
        <View
          style={[
            styles.voiceCtaWrap,
            {
              top: chromePads.padTop + (hudNote ? 220 : 152),
              left: chromePads.padLeft + 4,
              right: chromePads.padRight + 4,
            },
          ]}
        >
          <Link
            href={{
              pathname: '/modules/carnet-vocal',
              params: {
                label: tripEnded.label ?? '',
                lat: String(tripEnded.lat),
                lon: String(tripEnded.lon),
                mode: tripEnded.mode,
              },
            }}
            asChild
          >
            <Pressable
              style={styles.voiceCta}
              accessibilityLabel="Ouvrir carnet vocal après trajet"
            >
              <Text style={styles.voiceCtaTxt}>
                Note vocale après trajet →
              </Text>
            </Pressable>
          </Link>
          <Pressable
            style={styles.voiceCtaDismiss}
            onPress={() => setTripEnded(null)}
            accessibilityLabel="Fermer invitation note vocale"
          >
            <Text style={styles.voiceCtaDismissTxt}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      <GpsDestinationMenu
        visible={destMenuOpen}
        destination={destSelection}
        getMyLocation={() =>
          gpsOk ? (lastWatchRef.current ?? liveOriginRef.current) : null
        }
        routeStatus={destRouteStatus}
        onClose={() => setDestMenuOpen(false)}
        onStartNavigation={() => {
          if (!gpsOk || !lastRoute?.ok) return false;
          startNavigation();
          setHudNote(
            modeLabel === 'camion'
              ? 'Navigation camion — alertes overlay immédiat'
              : 'Navigation voiture — marqueur = GPS live',
          );
          return true;
        }}
        onLabelUpdated={(place) => {
          setDestSelection((prev) =>
            prev
              ? { ...prev, label: place.label, tag: place.tag }
              : { lat: place.lat, lon: place.lon, label: place.label, tag: place.tag },
          );
        }}
        onFeedback={setHudNote}
        onOpenHistory={() => {
          void loadTripHistory().then((rows) => {
            setTripHistory(rows);
            setHistoryOpen(true);
          });
        }}
        onSaveMyLocation={() => {
          const origin = lastWatchRef.current ?? liveOriginRef.current;
          if (!origin || !gpsOk) {
            setHudNote('Enregistrer position — GPS appareil requis');
            return;
          }
          void savePlace({
            lat: origin.lat,
            lon: origin.lon,
            label: `Ma position ${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)}`,
          }).then((r) => {
            setHudNote(r.ok ? `Position GPS enregistrée · ${r.place.label}` : r.error);
          });
        }}
      />

      <GpsTripTimeline
        visible={historyOpen}
        trips={tripHistory}
        onClose={() => setHistoryOpen(false)}
        onSelectTrip={(trip) => {
          setHistoryOpen(false);
          setDestSelection({
            lat: trip.destination.lat,
            lon: trip.destination.lon,
            label: trip.destination.label ?? 'Destination historique',
          });
          proposeDestination(
            trip.destination.lat,
            trip.destination.lon,
            trip.destination.label ?? 'Historique',
          );
          if (trip.coords.length >= 2) {
            const replay: VehicleRouteResult = {
              ok: true,
              mode: trip.mode,
              coords: trip.coords,
              distanceKm: trip.distanceKm,
              durationMin: trip.durationMin,
              source: trip.mode === 'camion' ? 'valhalla-truck' : 'valhalla-auto',
              label: `Historique · ${trip.distanceKm} km · ~${trip.durationMin} min · ${trip.startedAt}`,
            };
            setLastRoute(replay);
            lastRouteRef.current = replay;
            injectRoute(replay);
          }
          setHudNote(
            `Trajet ${trip.startedAt.slice(0, 16)} · ${trip.origin.label ?? 'départ'} → ${trip.destination.label ?? 'arrivée'}`,
          );
        }}
      />

      <GpsStreetViewModal
        visible={streetView != null}
        lat={streetView?.lat ?? null}
        lon={streetView?.lon ?? null}
        onClose={() => setStreetView(null)}
      />

      <GpsRouteAlertOverlay
        alert={activeAlert}
        voiceEnabled={!voiceMuted}
        onDismiss={dismissAlert}
        onMuteVoice={() => {
          setVoiceMuted(true);
          void setNavSpeechMuted(true);
          stopNavSpeech();
        }}
      />
    </View>
  );
}

function WebIframe({
  html,
  onReady,
}: {
  html: string;
  onReady: (win: MapWindow | null) => void;
}) {
  return (
    <iframe
      title="Carte GPS"
      srcDoc={html}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      style={{ border: 'none', width: '100%', height: '100%', flex: 1 }}
      ref={(node) => {
        onReady((node?.contentWindow as MapWindow | null) ?? null);
      }}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.asphalt },
  boot: { alignItems: 'center', justifyContent: 'center' },
  bootTxt: { color: colors.white, fontWeight: '700' },
  searchWrap: { position: 'absolute', zIndex: 20 },
  searchRow: { flexDirection: 'row', gap: 6 },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  searchBtn: {
    backgroundColor: colors.signal,
    borderRadius: 11,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
  },
  searchBtnTxt: { color: colors.white, fontWeight: '800', fontSize: 12 },
  hits: {
    marginTop: 4,
    maxHeight: 220,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 11,
  },
  hitRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  hitTxt: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  hitSub: { color: colors.muted, fontSize: 11, fontWeight: '500', marginTop: 2 },
  note: {
    position: 'absolute',
    backgroundColor: 'rgba(27,36,48,0.9)',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  noteTxt: { color: colors.white, fontSize: 11, fontWeight: '600', lineHeight: 15 },
  voiceCtaWrap: {
    position: 'absolute',
    zIndex: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voiceCta: {
    flex: 1,
    backgroundColor: colors.signal,
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  voiceCtaTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
  voiceCtaDismiss: {
    backgroundColor: 'rgba(16,24,32,0.88)',
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  voiceCtaDismissTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
  reportRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportBtn: {
    backgroundColor: 'rgba(59,91,219,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
  },
  publishBtn: {
    backgroundColor: 'rgba(31,107,74,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
  },
  reportTxt: { color: colors.white, fontWeight: '800', fontSize: 12 },
  etaTxt: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(27,36,48,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    overflow: 'hidden',
    maxWidth: 180,
  },
  toolBtn: {
    backgroundColor: 'rgba(44,58,71,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 11,
  },
  toolBtnMuted: {
    backgroundColor: 'rgba(166,27,27,0.92)',
  },
});
