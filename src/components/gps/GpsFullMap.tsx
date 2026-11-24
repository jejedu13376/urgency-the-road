import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useFocusEffect, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView as RNWebView, type WebViewMessageEvent } from 'react-native-webview';
import { belowGlobalTopBar } from '../../chromeInsets';
import { useAuth } from '../../context/AuthContext';
import { useFleet } from '../../context/FleetContext';
import {
  GPS_WATCH_MAP_IDLE,
  GPS_WATCH_NAVIGATING,
  getDeviceCoords,
  haversineKm,
  watchDevicePosition,
} from '../../services/geo/deviceLocation';
import {
  fetchAddressSuggestions,
  isGooglePlacesConfigured,
  type AddressSuggestion,
} from '../../services/geo/addressSuggest';
import {
  newPlacesSessionToken,
  resolvePlaceCoords,
} from '../../services/geo/googlePlacesAutocomplete';
import {
  fetchPlaceDetailsWithReviews,
  type PlaceDetailsData,
} from '../../services/geo/googlePlacesDetails';
import { resolveNavigableDestination } from '../../services/geo/navigableDestination';
import { geocodePlace } from '../../services/geo/openMeteoGeocode';
import { PlaceReviewsPanel } from './PlaceReviewsPanel';
import {
  aqiFillColor,
  fetchAirQualityNear,
} from '../../services/geo/openWeatherAirQuality';
import {
  DEFAULT_ROUTE_AVOID,
  itineraryOptionToVehicleRoute,
  planItinerary,
  type ItineraryPlanResult,
  type RouteAvoidOptions,
} from '../../services/geo/planItinerary';
import {
  type VehicleRouteResult,
} from '../../services/geo/valhallaRoute';
import { listRoadHazards, reportHazard } from '../../services/firebase/hazardsService';
import {
  estimateProgressKm,
  upcomingTurnAt,
} from '../../services/gps/routeManeuvers';
import { useI18n } from '../../context/I18nContext';
import { t as translate } from '../../i18n';
import {
  loadNavSpeechMuted,
  setNavSpeechMuted,
  speakArrival,
  speakNavStarted,
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
  isCrowdReportKind,
  loadCrowdReports,
  mergeCloudHazards,
  type CrowdReport,
  type CrowdReportKind,
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
  loadOfflineMapManifest,
  offlineTilesInjectPayload,
  type OfflineMapManifest,
} from '../../services/gps/offlineMapTiles';
import {
  GpsDestinationMenu,
  type GpsDestinationSelection,
  type GpsRouteStatus,
  type GpsWaypoint,
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
  allowFileAccessFromFileURLs?: boolean;
  allowUniversalAccessFromFileURLs?: boolean;
  allowingReadAccessToURL?: string;
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
  'report',
]);

const REPORT_KIND_LABELS: Record<CrowdReportKind, string> = {
  police: 'Police',
  accident: 'Accident',
  ralentissement: 'Ralentissement',
  danger: 'Danger',
  obstacle: 'Obstacle',
  travaux: 'Travaux',
  autre: 'Autre',
};

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
      truck: {
        heightM: number;
        widthM: number;
        weightT: number;
        lengthM?: number;
        axleCount?: number;
        hazmat?: boolean;
      };
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
      traffic?: boolean;
      buildings3d?: boolean;
      aqi?: boolean;
      trafficSource?: string;
    }
  | { type: 'report'; kind: CrowdReportKind; lat: number; lon: number };

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
  if (msg.type === 'report') {
    if (!isCrowdReportKind(msg.kind)) return null;
    if (!isFiniteCoord(msg.lat) || !isFiniteCoord(msg.lon)) return null;
    if (msg.lat < -90 || msg.lat > 90 || msg.lon < -180 || msg.lon > 180) return null;
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
 * Voiture/camion = top chips only. Map tap/long-press = right report bubble;
 * search / « Itinéraire » pick = destination.
 * No Maps/Waze branding chips.
 */
export function GpsFullMap() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  /** Carte tab is full-bleed under the status inset; modules/gps sits under a white Stack header.
   * Pathname flips immediately on tab change (component stays mounted) — no focus lag flag. */
  const onCarteTab = pathname === '/carte' || Boolean(pathname?.endsWith('/carte'));
  const { t } = useI18n();
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
  const [offlinePack, setOfflinePack] = useState<OfflineMapManifest | null>(null);
  const [canPublishPolice, setCanPublishPolice] = useState(false);
  const [hudNote, setHudNote] = useState<string | null>(null);
  const [lastRoute, setLastRoute] = useState<VehicleRouteResult | null>(null);
  const [itineraryPlan, setItineraryPlan] = useState<ItineraryPlanResult | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [planBusy, setPlanBusy] = useState(false);
  const [routeAvoid, setRouteAvoid] = useState<RouteAvoidOptions>({ ...DEFAULT_ROUTE_AVOID });
  const routeAvoidRef = useRef<RouteAvoidOptions>({ ...DEFAULT_ROUTE_AVOID });
  const [waypoints, setWaypoints] = useState<GpsWaypoint[]>([]);
  const waypointsRef = useRef<GpsWaypoint[]>([]);
  const [stopSearchOpen, setStopSearchOpen] = useState(false);
  const [stopQ, setStopQ] = useState('');
  const [stopHits, setStopHits] = useState<AddressSuggestion[]>([]);
  const [stopBusy, setStopBusy] = useState(false);
  const [modeLabel, setModeLabel] = useState<GpsVehicleMode>('voiture');
  const [gpsOk, setGpsOk] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<AddressSuggestion[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const placesSessionRef = useRef(newPlacesSessionToken());
  const searchReqIdRef = useRef(0);
  const stopReqIdRef = useRef(0);
  const skipSuggestRef = useRef(false);
  const placesConfigured = isGooglePlacesConfigured();
  const placeReviewsReqIdRef = useRef(0);
  /** User dismissed avis card — destination apply may still finish; do not reopen panel. */
  const placeReviewsDismissedRef = useRef(false);
  const [placeReviewsOpen, setPlaceReviewsOpen] = useState(false);
  const [placeReviewsBusy, setPlaceReviewsBusy] = useState(false);
  const [placeReviewsDetails, setPlaceReviewsDetails] = useState<PlaceDetailsData | null>(null);
  const [placeReviewsStatus, setPlaceReviewsStatus] = useState<string | null>(null);
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
  /** React state mirrors navigatingRef so useFocusEffect can restart the GPS watch. */
  const [navWatchBoost, setNavWatchBoost] = useState(false);
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
  /** Avoid setState on every GPS tick when already live. */
  const gpsOkRef = useRef(false);
  /** Coalesce WebView/iframe position injects to one frame. */
  const pendingLiveRef = useRef<{
    lat: number;
    lon: number;
    ok: boolean;
    heading: number | null;
    speed: number | null;
  } | null>(null);
  const liveRafRef = useRef<number | null>(null);

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
      // Clear persistent GlobalTopBar overlay (brand + FR/EN/ES) on every page including Carte.
      padTop: belowGlobalTopBar(insets) + 4,
      padRight: Math.max(insets.right, 8),
      padBottom: Math.max(insets.bottom, 8) + SOS_FAB_CLEARANCE,
      padLeft: Math.max(insets.left, 8),
    }),
    [insets],
  );

  const injectJs = useCallback((script: string) => {
    if (Platform.OS === 'web') return;
    webRef.current?.injectJavaScript(`${script}; true;`);
  }, []);

  const injectOfflineTiles = useCallback(
    (manifest: OfflineMapManifest | null) => {
      if (!manifest) return;
      const payload = offlineTilesInjectPayload(manifest);
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'setOfflineTiles', payload });
        return;
      }
      injectJs(
        `window.__gpsSetOfflineTiles && window.__gpsSetOfflineTiles(${JSON.stringify(payload)})`,
      );
    },
    [injectJs],
  );

  useEffect(() => {
    let cancelled = false;
    void loadOfflineMapManifest().then((m) => {
      if (!cancelled) setOfflinePack(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !offlinePack) return;
    injectOfflineTiles(offlinePack);
  }, [mapReady, offlinePack, injectOfflineTiles]);

  const injectRoute = useCallback(
    (
      result: VehicleRouteResult,
      extras?: {
        alternatives?: { coords: [number, number][] }[];
        waypoints?: { lat: number; lon: number; label?: string }[];
      },
    ) => {
      const payload = {
        ...result,
        alternatives: extras?.alternatives ?? [],
        waypoints: extras?.waypoints ?? [],
      };
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'applyRoute', payload });
        return;
      }
      injectJs(`window.__gpsApplyRoute && window.__gpsApplyRoute(${JSON.stringify(payload)})`);
    },
    [injectJs],
  );

  const applyItineraryPlan = useCallback(
    (plan: ItineraryPlanResult, selectedIdx = 0) => {
      setItineraryPlan(plan);
      const idx = Math.max(0, Math.min(selectedIdx, Math.max(0, plan.options.length - 1)));
      setSelectedOptionIndex(idx);
      if (!plan.ok || !plan.options.length) {
        setLastRoute(
          plan.ok
            ? null
            : {
                ok: false,
                mode: plan.mode,
                coords: [],
                distanceKm: 0,
                durationMin: 0,
                source: 'none',
                label: plan.label,
                error: plan.error,
              },
        );
        lastRouteRef.current = null;
        return;
      }
      const selected = plan.options[idx] ?? plan.options[0];
      const vehicle = itineraryOptionToVehicleRoute(selected, plan.mode);
      setLastRoute(vehicle);
      lastRouteRef.current = vehicle;
      const alts = plan.options
        .filter((_, i) => i !== idx)
        .map((o) => ({ coords: o.coords }));
      injectRoute(vehicle, {
        alternatives: alts,
        waypoints: waypointsRef.current.map((w) => ({
          lat: w.lat,
          lon: w.lon,
          label: w.label,
        })),
      });
    },
    [injectRoute],
  );

  const flushLivePosition = useCallback(() => {
    liveRafRef.current = null;
    const pending = pendingLiveRef.current;
    if (!pending) return;
    pendingLiveRef.current = null;
    const { lat, lon, ok, heading, speed } = pending;
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
  }, [injectJs]);

  const injectLivePosition = useCallback(
    (lat: number, lon: number, ok: boolean, heading: number | null, speed: number | null) => {
      liveOriginRef.current = { lat, lon };
      pendingLiveRef.current = { lat, lon, ok, heading, speed };
      if (liveRafRef.current != null) return;
      liveRafRef.current = requestAnimationFrame(flushLivePosition);
    },
    [flushLivePosition],
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
    (mode: GpsVehicleMode, prefs: GpsNavPrefs, opts?: { skipRoute?: boolean }) => {
      const truck = {
        heightM: prefs.truckHeightM,
        widthM: prefs.truckWidthM,
        weightT: prefs.truckPtacT,
        lengthM: prefs.truckLengthM,
        axleCount: prefs.axleCount,
        hazmat: prefs.hazmat,
      };
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'applyMode', mode, truck, opts });
        return;
      }
      injectJs(
        `window.__gpsApplyMode && window.__gpsApplyMode(${JSON.stringify(mode)}, ${JSON.stringify(truck)}, ${JSON.stringify(opts ?? {})})`,
      );
    },
    [injectJs],
  );

  /** Sync Leaflet BOOT gabarit without requestRoute (safe during an in-flight route). */
  const syncTruckDimsInMap = useCallback(
    (prefs: GpsNavPrefs) => {
      const truck = {
        heightM: prefs.truckHeightM,
        widthM: prefs.truckWidthM,
        weightT: prefs.truckPtacT,
      };
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'setTruckDims', truck });
        return;
      }
      injectJs(`window.__gpsSetTruckDims && window.__gpsSetTruckDims(${JSON.stringify(truck)})`);
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

  const notifyReportResult = useCallback(
    (payload: { ok: boolean; label?: string; error?: string }) => {
      if (Platform.OS === 'web') {
        postGpsCmd(iframeWinRef.current, { cmd: 'reportResult', ...payload });
        return;
      }
      injectJs(
        `window.__gpsReportResult && window.__gpsReportResult(${JSON.stringify(payload)})`,
      );
    },
    [injectJs],
  );

  /** Paint crowd report pins even when Overpass refresh is gated on device GPS. */
  const paintCrowdReports = useCallback(async () => {
    if (!bootHtml) return;
    const [localReports, cloudHazards] = await Promise.all([
      loadCrowdReports(),
      listRoadHazards(),
    ]);
    const reports = mergeCloudHazards(localReports, cloudHazards.data ?? []);
    reportsRef.current = reports;
    const prev = lastLayersRef.current ?? { bridges: [], weigh: [], reports: [] };
    injectLayers({
      bridges: prev.bridges ?? [],
      weigh: prev.weigh ?? [],
      reports: reports.map((r) => ({
        id: r.id,
        kind: r.kind,
        lat: r.lat,
        lon: r.lon,
        note: r.note ? r.note.replace(/[<>&"'`]/g, '').slice(0, 80) : undefined,
        source: r.source,
      })),
    });
  }, [bootHtml, injectLayers]);

  const refreshLayers = useCallback(async () => {
    // Overpass around a real device fix only — never France overview centroid.
    const origin = lastWatchRef.current ?? (gpsOk ? liveOriginRef.current : null);
    if (!origin || !bootHtml || !gpsOk) return;
    // Reload storage so bridge PASS/NO-PASS matches profil-camion after a save.
    const prefs = await loadGpsNavPrefs();
    prefsRef.current = prefs;
    const truck = {
      heightM: prefs.truckHeightM,
      weightT: prefs.truckPtacT,
      widthM: prefs.truckWidthM,
      lengthM: prefs.truckLengthM,
      axleCount: prefs.axleCount,
      hazmat: prefs.hazmat,
    };
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
    async (lat: number, lon: number, routeCoords?: [number, number][]) => {
      const prefs = prefsRef.current ?? (await loadGpsNavPrefs());
      const brief = await buildTruckerRouteBrief(lat, lon, prefs, {
        routeCoords: routeCoords?.length ? routeCoords : lastRouteRef.current?.coords,
      });
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
        // Never paint a map banner for missing EXPO_PUBLIC_* keys (e.g. OpenWeather).
        if (res.error !== 'missing_key') setHudNote(res.label);
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
      gpsOkRef.current = deviceOk;
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
      const tomtomApiKey = (
        process.env.EXPO_PUBLIC_TOMTOM_API_KEY ??
        process.env.TOMTOM_API_KEY ??
        ''
      ).trim();
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
          tomtomApiKey: tomtomApiKey || undefined,
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

  /** Continuous LIVE GPS while Carte / GPS screen is focused — inject ticks, no remount.
   * Also reload gabarit from AsyncStorage (profil-camion may have updated while away). */
  useFocusEffect(
    useCallback(() => {
      let sub: { remove: () => void } | null = null;
      let cancelled = false;
      void (async () => {
        const stored = await loadGpsNavPrefs();
        if (cancelled) return;
        prefsRef.current = stored;
        setModeLabel(stored.mode);
        if (bootedRef.current && bootHtml) {
          applyModeInMap(stored.mode, stored);
        }

        const next = await watchDevicePosition(
          (pos) => {
            if (cancelled) return;
            lastWatchRef.current = { lat: pos.lat, lon: pos.lon };
            if (!gpsOkRef.current) {
              gpsOkRef.current = true;
              setGpsOk(true);
            }
            // Clear boot timeout / permission refusal once live GPS is real.
            setHudNote((prev) => {
              if (!prev || !/GPS appareil|GPS timeout|localisation/i.test(prev)) return prev;
              return null;
            });
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
                // ~60 m arrival radius — log trip complete for Chronologie + stop nav TTS/alerts.
                if (toDestKm <= 0.06) {
                  // Sync clear before any async — HTML may also post `arrived`.
                  navigatingRef.current = false;
                  setNavWatchBoost(false);
                  navDestRef.current = null;
                  shownAlertIdsRef.current = new Set();
                  highlightedWeighIdRef.current = null;
                  injectHighlightWeigh(null);
                  setTripEnded({
                    lat: dest.lat,
                    lon: dest.lon,
                    mode: lastRouteRef.current?.mode === 'camion' ? 'camion' : 'voiture',
                    label: destLabelRef.current,
                  });
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
                // Module-level translate — do not close over hook `t` (would restart GPS watch on locale change).
                const weighLabel = translate('tts.weighDefault');
                const distSpoken = translate('tts.kilometers', { km: rounded });
                enqueueAlerts([
                  {
                    id: `weigh-nav-${s.id}`,
                    kind: 'weigh',
                    title: `Balance à ${rounded} km`,
                    detail: `${s.name} · OSM weigh_station / weighbridge (CA/US/EU) — overlay immédiat`,
                    voice: translate('tts.weighAlert', {
                      label: weighLabel,
                      distance: distSpoken,
                    }),
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
            gpsOkRef.current = false;
            setGpsOk(false);
            // Keep map GPS state in sync — do not leave marker/routing as if live.
            // Never invent France centroid: keep last known origin + route graphics.
            const origin = lastWatchRef.current ?? liveOriginRef.current;
            if (origin) {
              injectLivePosition(origin.lat, origin.lon, false, null, null);
            }
            setHudNote(`GPS live — ${err}`);
          },
          navWatchBoost ? GPS_WATCH_NAVIGATING : GPS_WATCH_MAP_IDLE,
        );
        if (cancelled) {
          next?.remove();
          return;
        }
        sub = next;
      })();
      return () => {
        cancelled = true;
        if (liveRafRef.current != null) {
          cancelAnimationFrame(liveRafRef.current);
          liveRafRef.current = null;
        }
        sub?.remove();
      };
    }, [
      injectLivePosition,
      setMapOrigin,
      injectHighlightWeigh,
      enqueueAlerts,
      applyModeInMap,
      bootHtml,
      navWatchBoost,
    ]),
  );

  useEffect(() => {
    if (!bootHtml || !gpsOk || !mapReady) return;
    void refreshLayers();
    const layerTimer = setInterval(() => void refreshLayers(), 90_000);
    return () => clearInterval(layerTimer);
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
        // Offline pack may have loaded before Leaflet ready.
        void loadOfflineMapManifest().then((m) => {
          if (m) {
            setOfflinePack(m);
            injectOfflineTiles(m);
          }
        });
        return;
      }

      if (msg.type === 'mode') {
        setModeLabel(msg.mode);
        // Save silently — no HUD toast on car/truck chip toggle.
        void saveGpsNavPrefs({ mode: msg.mode }).then((p) => {
          prefsRef.current = p;
        });
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
            setHudNote('GPS appareil OK');
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
          // Persist mode only — saveGpsNavPrefs reloads storage then merges the
          // patch, so a concurrent saveTruckerProfile cannot be clobbered by a
          // stale {...stored} snapshot. Never write map BOOT height/width/weight
          // back. Sync BOOT via setTruckDims (no requestRoute) — never applyModeInMap
          // here or __gpsApplyMode re-posts route and loops Valhalla/Overpass.
          const livePrefs = await saveGpsNavPrefs({ mode: msg.mode });
          prefsRef.current = livePrefs;
          syncTruckDimsInMap(livePrefs);
          if (reqId !== routeReqId.current) return;

          const from = liveOriginRef.current ?? msg.from;
          // Soft-fail cloud excludes until Firestore rules validate kind/coords/expiry.
          // Only LOCAL crowd reports may steer Valhalla (device-authored, rate-limited).
          const excludes = reportsRef.current
            .filter(
              (r) =>
                r.source === 'local' &&
                (r.kind === 'police' ||
                  r.kind === 'accident' ||
                  r.kind === 'danger' ||
                  r.kind === 'ralentissement') &&
                Number.isFinite(r.lat) &&
                Number.isFinite(r.lon),
            )
            .slice(0, 8)
            .map((r) => ({ lat: r.lat, lon: r.lon }));

          setPlanBusy(true);
          try {
            const plan = await planItinerary({
              from,
              to: msg.to,
              mode: msg.mode,
              avoid: routeAvoidRef.current,
              waypoints: waypointsRef.current.map((w) => ({ lat: w.lat, lon: w.lon })),
              truck: {
                heightM: livePrefs.truckHeightM,
                widthM: livePrefs.truckWidthM,
                weightT: livePrefs.truckPtacT,
                lengthM: livePrefs.truckLengthM,
                axleCount: livePrefs.axleCount,
                hazmat: livePrefs.hazmat,
              },
              excludeLocations: excludes,
            });
            if (reqId !== routeReqId.current) return;
            // Bridge/weight/weather fire IMMEDIATE overlays via trucker brief (not passive HUD).
            // Reset alert dedupe for this new route so later trips still get overlays;
            // navigating must NOT clear again (avoids double-speak on Démarrer).
            shownAlertIdsRef.current = new Set();
            applyItineraryPlan(plan, 0);
            setHudNote(plan.label);
            void refreshLayers();
            const originPt = liveOriginRef.current ?? msg.from;
            const primaryCoords = plan.ok ? plan.options[0]?.coords : undefined;
            void runTruckerBrief(originPt.lat, originPt.lon, primaryCoords);
          } finally {
            if (reqId === routeReqId.current) setPlanBusy(false);
          }
        })();
        return;
      }

      if (msg.type === 'navigating' && msg.to) {
        setTripEnded(null);
        navigatingRef.current = true;
        setNavWatchBoost(true);
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
          speakNavStarted({
            mode: msg.mode === 'camion' ? 'camion' : 'voiture',
            distanceKm: route.distanceKm,
            durationMin: route.durationMin,
          });
        }
        return;
      }

      if (msg.type === 'arrived' && msg.to) {
        // Idempotent — HTML + RN watch may both detect ~60–80 m arrival.
        if (!navigatingRef.current && !activeTripIdRef.current) return;
        navigatingRef.current = false;
        setNavWatchBoost(false);
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

      if (msg.type === 'report') {
        // Map tap/long-press → right bubble pick — local crowd pin only (no form).
        void (async () => {
          const label = REPORT_KIND_LABELS[msg.kind] ?? msg.kind;
          const local = await addCrowdReport({
            kind: msg.kind,
            lat: msg.lat,
            lon: msg.lon,
            note: `${label} (carte · expire ~45 min)`,
          });
          if (!local.ok) {
            setHudNote(local.error);
            notifyReportResult({ ok: false, error: local.error });
            return;
          }
          if (msg.kind === 'police') {
            lastLocalPoliceRef.current = local.report;
            setCanPublishPolice(true);
          }
          setHudNote(`${label} posé sur la carte (~45 min)`);
          // Always paint the new pin (refreshLayers no-ops without device GPS).
          await paintCrowdReports();
          if (gpsOk) void refreshLayers();
          notifyReportResult({ ok: true, label });
        })();
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
      applyItineraryPlan,
      setMapOrigin,
      refreshLayers,
      paintCrowdReports,
      notifyReportResult,
      injectLayers,
      injectOfflineTiles,
      runTruckerBrief,
      destSelection?.label,
      injectHighlightWeigh,
      refreshAqi,
      syncTruckDimsInMap,
    ],
  );

  /** Recompute itinerary when sheet options / stops / vehicle change (dest already set). */
  const replanCurrentDestination = useCallback(
    async (opts?: {
      mode?: GpsVehicleMode;
      avoid?: RouteAvoidOptions;
      waypoints?: GpsWaypoint[];
    }) => {
      const dest = destSelection;
      const origin = liveOriginRef.current;
      if (!dest || !origin || !gpsOk) return;
      const mode = opts?.mode ?? modeLabel;
      const avoid = opts?.avoid ?? routeAvoidRef.current;
      const stops = opts?.waypoints ?? waypointsRef.current;
      const prefs = prefsRef.current;
      const reqId = ++routeReqId.current;
      setPlanBusy(true);
      setHudNote('Recalcul itinéraire…');
      const excludes = reportsRef.current
        .filter(
          (r) =>
            r.source === 'local' &&
            (r.kind === 'police' ||
              r.kind === 'accident' ||
              r.kind === 'danger' ||
              r.kind === 'ralentissement') &&
            Number.isFinite(r.lat) &&
            Number.isFinite(r.lon),
        )
        .slice(0, 8)
        .map((r) => ({ lat: r.lat, lon: r.lon }));
      try {
        const plan = await planItinerary({
          from: origin,
          to: { lat: dest.lat, lon: dest.lon },
          mode,
          avoid,
          waypoints: stops.map((w) => ({ lat: w.lat, lon: w.lon })),
          truck: prefs
            ? {
                heightM: prefs.truckHeightM,
                widthM: prefs.truckWidthM,
                weightT: prefs.truckPtacT,
                lengthM: prefs.truckLengthM,
                axleCount: prefs.axleCount,
                hazmat: prefs.hazmat,
              }
            : undefined,
          excludeLocations: excludes,
        });
        if (reqId !== routeReqId.current) return;
        applyItineraryPlan(plan, 0);
        setHudNote(plan.label);
      } finally {
        if (reqId === routeReqId.current) setPlanBusy(false);
      }
    },
    [destSelection, gpsOk, modeLabel, applyItineraryPlan],
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

  /** Confirm a resolved place: fill search, open dest menu, center map. */
  const commitDestination = useCallback(
    (lat: number, lon: number, label: string, noteSuffix?: string) => {
      // Province/state/country centroids → navigable city (BC wilderness, FL, NSW…).
      const nav = resolveNavigableDestination(lat, lon, label);
      const destLat = nav.lat;
      const destLon = nav.lon;
      const destLabel = nav.label;
      const remapNote = nav.remapped ? `ville navigable · ${nav.adminKey}` : undefined;
      const note = [noteSuffix, remapNote].filter(Boolean).join(' · ') || undefined;
      applyDestinationLabel(destLabel);
      setDestSelection({ lat: destLat, lon: destLon, label: destLabel });
      setLastRoute(null);
      proposeDestination(destLat, destLon, destLabel);
      setDestMenuOpen(true);
      setHudNote(note ? `Destination · ${destLabel} · ${note}` : `Destination · ${destLabel}`);
      void (async () => {
        const saved = await findSavedPlace(destLat, destLon);
        if (!saved?.tag) return;
        setDestSelection((prev) =>
          prev && prev.lat === destLat && prev.lon === destLon
            ? { ...prev, tag: saved.tag }
            : prev,
        );
      })();
    },
    [applyDestinationLabel, proposeDestination],
  );

  /** Hide avis only — do not abandon the in-flight place pick (destination may still land). */
  const closePlaceReviews = useCallback(() => {
    placeReviewsDismissedRef.current = true;
    setPlaceReviewsOpen(false);
    setPlaceReviewsBusy(false);
    setPlaceReviewsDetails(null);
    setPlaceReviewsStatus(null);
  }, []);

  /**
   * User started a new search intent — drop any pending Details → destination
   * and clear a stuck “Chargement des avis…” card (cancelled path never updates UI).
   */
  const abandonPendingPlacePick = useCallback(() => {
    placeReviewsReqIdRef.current += 1;
    placeReviewsDismissedRef.current = true;
    setPlaceReviewsOpen(false);
    setPlaceReviewsBusy(false);
    setPlaceReviewsDetails(null);
    setPlaceReviewsStatus(null);
  }, []);

  /**
   * Place select → one Place Details (coords + rating + avis), then route via commitDestination.
   * Returns `cancelled` when a newer pick / search superseded this one (not a real failure).
   */
  const applySelectedPlace = useCallback(
    async (
      placeId: string,
      fallbackLabel: string,
    ): Promise<'ok' | 'error' | 'cancelled'> => {
      const reqId = ++placeReviewsReqIdRef.current;
      placeReviewsDismissedRef.current = false;
      setPlaceReviewsOpen(true);
      setPlaceReviewsBusy(true);
      setPlaceReviewsDetails(null);
      setPlaceReviewsStatus(null);

      const session = placesSessionRef.current;
      placesSessionRef.current = newPlacesSessionToken();

      const res = await fetchPlaceDetailsWithReviews(placeId, session);
      if (reqId !== placeReviewsReqIdRef.current) return 'cancelled';

      if (!res.ok || !res.data || !Number.isFinite(res.data.lat) || !Number.isFinite(res.data.lon)) {
        setHudNote(res.error ?? 'Place Details KO');
        if (!placeReviewsDismissedRef.current) {
          setPlaceReviewsBusy(false);
          setPlaceReviewsDetails(null);
          setPlaceReviewsStatus(res.error ?? 'Avis Google indisponibles pour ce lieu');
        }
        return 'error';
      }

      if (reqId !== placeReviewsReqIdRef.current) return 'cancelled';

      const label = res.data.label || fallbackLabel;
      // Destination lands for the current pick — even if avis card was dismissed.
      commitDestination(res.data.lat, res.data.lon, label);

      if (placeReviewsDismissedRef.current) {
        return 'ok';
      }

      setPlaceReviewsBusy(false);
      setPlaceReviewsDetails(res.data);
      setPlaceReviewsStatus(
        typeof res.data.rating !== 'number' && res.data.reviews.length === 0
          ? 'Aucun avis Google pour ce lieu'
          : null,
      );
      return 'ok';
    },
    [commitDestination],
  );

  /** Debounced live address suggestions (Places when keyed, else Open-Meteo/Photon). */
  useEffect(() => {
    if (skipSuggestRef.current) {
      skipSuggestRef.current = false;
      return;
    }
    // Real keystrokes abandon a pending Details destination (close-panel alone does not).
    abandonPendingPlacePick();
    const q = searchQ.trim();
    const reqId = ++searchReqIdRef.current;
    const timer = setTimeout(() => {
      void (async () => {
        if (reqId !== searchReqIdRef.current) return;
        if (q.length < 2) {
          setSearchOpen(false);
          setSearchHits([]);
          setSearchBusy(false);
          return;
        }
        setSearchBusy(true);
        try {
          const res = await fetchAddressSuggestions(q, placesSessionRef.current, {
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
  }, [searchQ, abandonPendingPlacePick]);

  /** Apply one address hit — Places Details when placeId, else geocode coords. */
  const applyAddressHit = useCallback(
    async (hit: AddressSuggestion): Promise<'ok' | 'error' | 'cancelled'> => {
      if (
        hit.placeId &&
        placesConfigured &&
        typeof hit.lat !== 'number' &&
        typeof hit.lon !== 'number'
      ) {
        return applySelectedPlace(hit.placeId, hit.label);
      }
      if (typeof hit.lat === 'number' && typeof hit.lon === 'number') {
        commitDestination(hit.lat, hit.lon, hit.label, hit.source);
        return 'ok';
      }
      if (hit.placeId) {
        return applySelectedPlace(hit.placeId, hit.label);
      }
      setHudNote('Adresse incomplete — pas de coordonnées');
      return 'error';
    },
    [placesConfigured, applySelectedPlace, commitDestination],
  );

  /** Explicit OK: one hit → go; several → keep list open. */
  const runSearch = useCallback(async () => {
    const q = searchQ.trim();
    if (!q) return;
    searchReqIdRef.current += 1;
    // Abandon before any await — otherwise a late Details can race during autocomplete.
    abandonPendingPlacePick();
    setSearchBusy(true);
    setSearchOpen(true);
    try {
      const res = await fetchAddressSuggestions(q, placesSessionRef.current, {
        limit: 6,
      });
      setSearchHits(res.suggestions);
      if (res.suggestions.length === 1) {
        const outcome = await applyAddressHit(res.suggestions[0]);
        if (outcome === 'error') skipSuggestRef.current = false;
        return;
      }
      if (!res.ok) {
        setHudNote(res.error ?? 'Adresse introuvable');
      } else {
        setHudNote(`${res.suggestions.length} adresse(s) · ${res.source}`);
      }
    } finally {
      setSearchBusy(false);
    }
  }, [searchQ, applyAddressHit, abandonPendingPlacePick]);

  const pickSearchHit = useCallback(
    (hit: AddressSuggestion) => {
      void (async () => {
        invalidateInFlightSuggest();
        setSearchBusy(true);
        try {
          const outcome = await applyAddressHit(hit);
          if (outcome === 'error') skipSuggestRef.current = false;
        } finally {
          setSearchBusy(false);
        }
      })();
    },
    [invalidateInFlightSuggest, applyAddressHit],
  );

  /** Debounced étape address suggestions (same Places / geocode path). */
  useEffect(() => {
    if (!stopSearchOpen) return;
    const q = stopQ.trim();
    const reqId = ++stopReqIdRef.current;
    const timer = setTimeout(() => {
      void (async () => {
        if (reqId !== stopReqIdRef.current) return;
        if (q.length < 2) {
          setStopHits([]);
          setStopBusy(false);
          return;
        }
        setStopBusy(true);
        try {
          const r = await fetchAddressSuggestions(q, placesSessionRef.current, {
            limit: 6,
          });
          if (reqId !== stopReqIdRef.current) return;
          setStopHits(r.suggestions);
        } finally {
          if (reqId === stopReqIdRef.current) setStopBusy(false);
        }
      })();
    }, 320);
    return () => clearTimeout(timer);
  }, [stopQ, stopSearchOpen]);

  /** Resolve an address hit into a waypoint and replan. */
  const commitStopFromHit = useCallback(
    async (hit: AddressSuggestion): Promise<boolean> => {
      let lat = hit.lat;
      let lon = hit.lon;
      let label = hit.label;

      if (
        (typeof lat !== 'number' || typeof lon !== 'number') &&
        hit.placeId
      ) {
        const res = await resolvePlaceCoords(hit.placeId, placesSessionRef.current);
        if (!res.ok || res.lat == null || res.lon == null) return false;
        lat = res.lat;
        lon = res.lon;
        label = res.label || hit.label;
        placesSessionRef.current = newPlacesSessionToken();
      }

      if (typeof lat !== 'number' || typeof lon !== 'number') return false;

      const wp: GpsWaypoint = {
        id: `${lat.toFixed(5)},${lon.toFixed(5)}-${Date.now()}`,
        lat,
        lon,
        label: label || hit.label,
      };
      const next = [...waypointsRef.current, wp].slice(0, 6);
      waypointsRef.current = next;
      setWaypoints(next);
      setStopSearchOpen(false);
      setStopQ('');
      setStopHits([]);
      void replanCurrentDestination({ waypoints: next });
      return true;
    },
    [replanCurrentDestination],
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

  // Light icons only on Carte tab (pathname). Tabs stay mounted — leaving Carte clears this
  // immediately. modules/gps keeps root dark StatusBar for the white Stack header.
  if (!bootHtml) {
    return (
      <View style={[styles.fill, styles.boot]}>
        {onCarteTab ? <StatusBar style="light" /> : null}
        <Text style={styles.bootTxt}>Chargement carte GPS…</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill} accessibilityLabel={`Carte GPS mode ${modeLabel}`}>
      {onCarteTab ? <StatusBar style="light" /> : null}
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
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={offlinePack?.rootUri}
          mixedContentMode="always"
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
            placeholder="Tapez une adresse…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => void runSearch()}
            accessibilityLabel="Recherche adresse — suggestions en direct"
            autoCorrect={false}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.searchBtn}
            onPress={() => void runSearch()}
            accessibilityLabel="Valider la recherche d’adresse"
          >
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
            keyExtractor={(item) => item.id}
            style={styles.hits}
            accessibilityLabel="Suggestions d’adresse"
            renderItem={({ item }) => (
              <Pressable
                style={styles.hitRow}
                onPress={() => pickSearchHit(item)}
                accessibilityRole="button"
                accessibilityLabel={`Adresse ${item.label}`}
              >
                <Text style={styles.hitTxt} numberOfLines={2}>
                  {item.mainText || item.label}
                </Text>
                {item.secondaryText ? (
                  <Text style={styles.hitSub} numberOfLines={2}>
                    {item.secondaryText}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
        ) : null}
      </View>

      {/* Left-side tool rail — hide while search hits open so FlatList wins taps. */}
      {!(searchOpen && searchHits.length > 0) ? (
        <View
          style={[
            styles.sideRail,
            {
              top: chromePads.padTop + 108,
              left: chromePads.padLeft + 8,
              zIndex: 15,
              elevation: 15,
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.sideRailCard}>
            <Pressable
              style={styles.sideFabPolice}
              onPress={dropPoliceReport}
              accessibilityLabel="Signaler police"
            >
              <Text style={styles.sideFabTxt}>Police</Text>
            </Pressable>
            {canPublishPolice ? (
              <Pressable
                style={styles.sideFabPublish}
                onPress={publishPoliceCloud}
                accessibilityLabel="Publier signalement"
              >
                <Text style={styles.sideFabTxt}>Publier</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.sideFab}
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
              <Text style={styles.sideFabTxtDark}>Sauver</Text>
            </Pressable>
            <Pressable
              style={styles.sideFab}
              onPress={() => {
                // Left-rail Chrono (= kept “store” / trip control) → Chronologie sheet.
                void loadTripHistory().then((rows) => {
                  setTripHistory(rows);
                  setHistoryOpen(true);
                });
              }}
              accessibilityLabel="Ouvrir la chronologie des trajets"
              testID="gps-chrono-button"
            >
              <Text style={styles.sideFabTxtDark}>Chrono</Text>
            </Pressable>
            <Pressable
              style={[styles.sideFab, voiceMuted && styles.sideFabMuted]}
              onPress={() => {
                const next = !voiceMuted;
                setVoiceMuted(next);
                void setNavSpeechMuted(next);
                if (next) stopNavSpeech();
                setHudNote(next ? t('tts.mutedHud') : t('tts.unmutedHud'));
              }}
              accessibilityRole="button"
              accessibilityLabel={voiceMuted ? t('tts.unmuteA11y') : t('tts.muteA11y')}
              accessibilityState={{ checked: voiceMuted }}
              testID="gps-voice-mute"
            >
              <Text style={voiceMuted ? styles.sideFabTxt : styles.sideFabTxtDark}>
                {voiceMuted ? t('tts.mute') : t('tts.unmute')}
              </Text>
            </Pressable>
          </View>
          {/* ETA = HTML bar under Itinéraire (#62 / UR-105) — no RN duplicate. */}
        </View>
      ) : null}

      {hudNote ? (
        <View
          pointerEvents="none"
          style={[
            styles.note,
            {
              top: chromePads.padTop + 108,
              left: chromePads.padLeft + 100,
              right: chromePads.padRight + 56,
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
              top: chromePads.padTop + (hudNote ? 168 : 108),
              left: chromePads.padLeft + 100,
              right: chromePads.padRight + 56,
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
        vehicleMode={modeLabel}
        avoid={routeAvoid}
        waypoints={waypoints}
        plan={itineraryPlan}
        selectedOptionIndex={selectedOptionIndex}
        planBusy={planBusy}
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
        onVehicleModeChange={(mode) => {
          setModeLabel(mode);
          void (async () => {
            const livePrefs = await saveGpsNavPrefs({ mode });
            prefsRef.current = livePrefs;
            applyModeInMap(mode, livePrefs, { skipRoute: true });
            await replanCurrentDestination({ mode });
          })();
        }}
        onAvoidChange={(patch) => {
          const next = { ...routeAvoidRef.current, ...patch };
          routeAvoidRef.current = next;
          setRouteAvoid(next);
          void replanCurrentDestination({ avoid: next });
        }}
        onSelectOption={(index) => {
          if (!itineraryPlan?.ok) return;
          applyItineraryPlan(itineraryPlan, index);
        }}
        onAddWaypointRequest={() => {
          setStopQ('');
          setStopHits([]);
          setStopSearchOpen(true);
        }}
        onRemoveWaypoint={(id) => {
          const next = waypointsRef.current.filter((w) => w.id !== id);
          waypointsRef.current = next;
          setWaypoints(next);
          void replanCurrentDestination({ waypoints: next });
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
        onOfflinePackReady={(manifest) => {
          setOfflinePack(manifest);
          injectOfflineTiles(manifest);
          setHudNote(
            `Carte hors ligne active · ${manifest.tileCount} tuiles (routes + satellite)`,
          );
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
            label: trip.destination.label ?? 'Destination chronologie',
          });
          proposeDestination(
            trip.destination.lat,
            trip.destination.lon,
            trip.destination.label ?? 'Chronologie',
          );
          if (trip.coords.length >= 2) {
            const replay: VehicleRouteResult = {
              ok: true,
              mode: trip.mode,
              coords: trip.coords,
              distanceKm: trip.distanceKm,
              durationMin: trip.durationMin,
              source: trip.mode === 'camion' ? 'valhalla-truck' : 'valhalla-auto',
              label: `Chronologie · ${trip.distanceKm} km · ~${trip.durationMin} min · ${trip.startedAt}`,
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

      {/* Above map .bottom CTA (itinéraire / GPS / HTML ETA bar) — leave room for dest menu. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: chromePads.padLeft + 4,
          right: chromePads.padRight + 4,
          bottom: chromePads.padBottom + (lastRoute?.ok ? 108 : 58),
          zIndex: 25,
          elevation: 25,
        }}
      >
        <PlaceReviewsPanel
          visible={placeReviewsOpen}
          busy={placeReviewsBusy}
          details={placeReviewsDetails}
          statusMessage={placeReviewsStatus}
          onClose={closePlaceReviews}
          maxReviews={3}
        />
      </View>

      <Modal
        visible={stopSearchOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setStopSearchOpen(false)}
      >
        <Pressable
          style={styles.stopBackdrop}
          onPress={() => setStopSearchOpen(false)}
          accessibilityLabel="Fermer ajout d’étape"
        />
        <View style={styles.stopSheet}>
          <Text style={styles.stopTitle}>Ajouter une étape</Text>
          <View style={styles.searchRow}>
            <TextInput
              value={stopQ}
              onChangeText={setStopQ}
              placeholder="Tapez une adresse d’étape…"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoFocus
              accessibilityLabel="Recherche adresse étape — suggestions en direct"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.searchBtn}
              onPress={() => {
                void (async () => {
                  const q = stopQ.trim();
                  if (!q) return;
                  // Always resolve against current stopQ — never reuse a stale stopHits[0].
                  stopReqIdRef.current += 1;
                  setStopBusy(true);
                  try {
                    const r = await fetchAddressSuggestions(q, placesSessionRef.current, {
                      limit: 6,
                    });
                    setStopHits(r.suggestions);
                    const hit = r.suggestions[0];
                    if (!hit) {
                      setHudNote(r.error ?? 'Étape introuvable');
                      return;
                    }
                    const ok = await commitStopFromHit(hit);
                    if (!ok) setHudNote('Étape KO');
                  } finally {
                    setStopBusy(false);
                  }
                })();
              }}
              accessibilityLabel="Valider l’adresse d’étape"
            >
              {stopBusy ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.searchBtnTxt}>OK</Text>
              )}
            </Pressable>
          </View>
          {stopHits.length > 0 ? (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={stopHits}
              keyExtractor={(item) => item.id}
              style={styles.hits}
              accessibilityLabel="Suggestions d’adresse pour étape"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.hitRow}
                  onPress={() => {
                    void (async () => {
                      setStopBusy(true);
                      try {
                        const ok = await commitStopFromHit(item);
                        if (!ok) setHudNote('Étape KO');
                      } finally {
                        setStopBusy(false);
                      }
                    })();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Étape ${item.label}`}
                >
                  <Text style={styles.hitTxt} numberOfLines={2}>
                    {item.mainText || item.label}
                  </Text>
                  {item.secondaryText ? (
                    <Text style={styles.hitSub} numberOfLines={2}>
                      {item.secondaryText}
                    </Text>
                  ) : null}
                </Pressable>
              )}
            />
          ) : null}
          <Pressable style={styles.stopCancel} onPress={() => setStopSearchOpen(false)}>
            <Text style={styles.stopCancelTxt}>Annuler</Text>
          </Pressable>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    borderWidth: 1.5,
    borderColor: 'rgba(211,217,223,0.9)',
    shadowColor: '#101820',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  searchBtn: {
    backgroundColor: colors.signal,
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 52,
    shadowColor: '#101820',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBtnTxt: { color: colors.white, fontWeight: '900', fontSize: 14 },
  hits: {
    marginTop: 6,
    maxHeight: 220,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(211,217,223,0.85)',
    shadowColor: '#101820',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  hitRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  hitTxt: { color: colors.ink, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  hitSub: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 2, lineHeight: 18 },
  note: {
    position: 'absolute',
    backgroundColor: 'rgba(27,36,48,0.9)',
    borderRadius: 12,
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
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#C45C26',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  voiceCtaTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
  voiceCtaDismiss: {
    backgroundColor: 'rgba(16,24,32,0.88)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  voiceCtaDismissTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
  sideRail: {
    position: 'absolute',
    alignItems: 'flex-start',
    gap: 8,
  },
  sideRailCard: {
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 4,
    gap: 2,
    shadowColor: '#101820',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  sideFab: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  sideFabPolice: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,91,219,0.95)',
  },
  sideFabPublish: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31,107,74,0.95)',
  },
  sideFabMuted: {
    backgroundColor: 'rgba(166,27,27,0.92)',
  },
  sideFabTxt: { color: colors.white, fontWeight: '800', fontSize: 12 },
  sideFabTxtDark: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  stopBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,24,32,0.4)',
  },
  stopSheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    maxHeight: '70%',
  },
  stopTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  stopCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  stopCancelTxt: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 15,
  },
});
