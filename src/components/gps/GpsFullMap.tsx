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
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView as RNWebView, type WebViewMessageEvent } from 'react-native-webview';
import { useFleet } from '../../context/FleetContext';
import { getDeviceCoords, watchDevicePosition } from '../../services/geo/deviceLocation';
import { geocodePlace, type GeocodeHit } from '../../services/geo/openMeteoGeocode';
import {
  fetchVehicleRoute,
  type VehicleRouteResult,
} from '../../services/geo/valhallaRoute';
import { listRoadHazards, reportHazard } from '../../services/firebase/hazardsService';
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
import { colors } from '../../theme/colors';
import { buildGpsMapHtml } from './buildGpsMapHtml';

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
  | { type: 'recenter' };

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
 * No Maps/Waze branding chips. Tap / search → voiture/camion → Valhalla.
 */
export function GpsFullMap() {
  const insets = useSafeAreaInsets();
  const { active } = useFleet();
  const webRef = useRef<WebViewHandle | null>(null);
  const iframeWinRef = useRef<MapWindow | null>(null);
  const routeReqId = useRef(0);
  const prefsRef = useRef<GpsNavPrefs | null>(null);
  const bootedRef = useRef(false);
  const fleetKeyRef = useRef<string | null>(null);
  const liveOriginRef = useRef<{ lat: number; lon: number } | null>(null);
  const reportsRef = useRef<CrowdReport[]>([]);
  const [bootHtml, setBootHtml] = useState<string | null>(null);
  const [hudNote, setHudNote] = useState<string | null>(null);
  const [lastRoute, setLastRoute] = useState<VehicleRouteResult | null>(null);
  const [modeLabel, setModeLabel] = useState<GpsVehicleMode>('voiture');
  const [gpsOk, setGpsOk] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<GeocodeHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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

  const refreshLayers = useCallback(async () => {
    const origin = liveOriginRef.current;
    if (!origin || !bootHtml) return;
    const prefs = prefsRef.current ?? (await loadGpsNavPrefs());
    const truck = { heightM: prefs.truckHeightM, weightT: prefs.truckPtacT };
    const [bridges, weigh, localReports, cloudHazards] = await Promise.all([
      fetchNearbyBridgeClearances(origin.lat, origin.lon, 18000, truck),
      fetchNearbyWeighStations(origin.lat, origin.lon, 60000),
      loadCrowdReports(),
      listRoadHazards(),
    ]);
    const reports = mergeCloudHazards(localReports, cloudHazards.data ?? []);
    reportsRef.current = reports;
    injectLayers({
      bridges: bridges.bridges,
      weigh: (weigh.stations ?? []).slice(0, 20).map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        status: s.status,
        litUp: s.litUp,
      })),
      reports: reports.map((r) => ({
        id: r.id,
        kind: r.kind,
        lat: r.lat,
        lon: r.lon,
        note: r.note,
      })),
    });
    const bits = [bridges.label, weigh.label].filter(Boolean);
    if (bits.length) setHudNote((prev) => prev ?? bits[0]);
  }, [bootHtml, injectLayers]);

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

      const loc = await getDeviceCoords({ allowFallback: false });
      if (cancelled) return;

      const deviceOk = loc.ok === true && loc.data?.source === 'device';
      const origin = deviceOk
        ? { lat: loc.data.lat, lon: loc.data.lon }
        : { lat: 46.5, lon: 2.5 };

      prefsRef.current = initial;
      liveOriginRef.current = origin;
      setModeLabel(initial.mode);
      setGpsOk(deviceOk);
      if (!deviceOk) {
        setHudNote(
          loc.ok === false
            ? `GPS appareil refusé — ${loc.error}. Activez la localisation.`
            : 'GPS appareil requis — autorisez la localisation.',
        );
      }
      bootedRef.current = true;
      setBootHtml(
        buildGpsMapHtml({
          lat: origin.lat,
          lon: origin.lon,
          mode: initial.mode,
          truckHeightM: initial.truckHeightM,
          truckWidthM: initial.truckWidthM,
          truckPtacT: initial.truckPtacT,
          gpsOk: deviceOk,
          ...chromePads,
        }),
      );
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
        sub = await watchDevicePosition(
          (pos) => {
            if (cancelled) return;
            setGpsOk(true);
            injectLivePosition(pos.lat, pos.lon, true, pos.headingDeg, pos.speedMps);
          },
          (err) => {
            if (cancelled) return;
            setGpsOk(false);
            setHudNote(`GPS live — ${err}`);
          },
        );
      })();
      return () => {
        cancelled = true;
        sub?.remove();
      };
    }, [injectLivePosition]),
  );

  useEffect(() => {
    if (!bootHtml || !gpsOk) return;
    void refreshLayers();
    const t = setInterval(() => void refreshLayers(), 90_000);
    return () => clearInterval(t);
  }, [bootHtml, gpsOk, modeLabel, refreshLayers]);

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
          const loc = await getDeviceCoords({ allowFallback: false });
          const deviceOk = loc.ok === true && loc.data?.source === 'device';
          setGpsOk(deviceOk);
          if (!deviceOk) {
            setHudNote(
              loc.ok === false
                ? `GPS appareil refusé — ${loc.error}`
                : 'GPS appareil requis — autorisez la localisation',
            );
            setMapOrigin(46.5, 2.5, false);
            return;
          }
          setHudNote('GPS appareil OK — suivi live');
          setMapOrigin(loc.data.lat, loc.data.lon, true);
        })();
        return;
      }

      if (msg.type === 'route') {
        if (!gpsOk) {
          setHudNote('Itinéraire bloqué — GPS appareil requis (pas de fallback Lille)');
          return;
        }
        setModeLabel(msg.mode);
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
          const excludes = reportsRef.current
            .filter((r) => r.kind === 'police' || r.kind === 'accident' || r.kind === 'danger')
            .map((r) => ({ lat: r.lat, lon: r.lon }));

          const route = await fetchVehicleRoute(from, msg.to, msg.mode, {
            heightM: msg.truck.heightM,
            widthM: msg.truck.widthM,
            weightT: msg.truck.weightT,
          }, { excludeLocations: excludes });
          if (reqId !== routeReqId.current) return;

          let label = route.label;
          if (msg.mode === 'camion' && route.ok) {
            const mid = route.coords[Math.floor(route.coords.length / 2)] ?? [
              from.lat,
              from.lon,
            ];
            const bridges = await fetchNearbyBridgeClearances(
              mid[0],
              mid[1],
              12000,
              { heightM: msg.truck.heightM, weightT: msg.truck.weightT },
            );
            if (reqId !== routeReqId.current) return;
            const risky = bridges.bridges.filter((b) => b.pass === 'no');
            if (risky.length) {
              label = `${route.label} · ⚠ ${risky.length} ouvrage(s) no-pass vs profil`;
            } else if (bridges.label) {
              label = `${route.label} · ${bridges.label}`;
            }
          }

          if (reqId !== routeReqId.current) return;
          const enriched = { ...route, label };
          setLastRoute(enriched);
          setHudNote(label);
          injectRoute(enriched);
          void refreshLayers();
        })();
        return;
      }

      if (msg.type === 'navigating' && msg.to) {
        setHudNote(
          msg.mode === 'camion'
            ? 'Navigation camion — marqueur = GPS live (pas de démo polyline)'
            : 'Navigation voiture — marqueur = GPS live',
        );
        return;
      }

      if (msg.type === 'arrived') {
        setHudNote('Arrivée — GPS live toujours actif');
      }
    },
    [gpsOk, injectRoute, setMapOrigin, refreshLayers],
  );

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

  const runSearch = useCallback(async () => {
    const q = searchQ.trim();
    if (!q) return;
    setSearchBusy(true);
    setSearchOpen(true);
    try {
      const res = await geocodePlace(q, 6);
      setSearchHits(res.hits);
      if (!res.ok) setHudNote(res.error ?? 'Adresse introuvable');
      else setHudNote(`${res.hits.length} résultat(s) · ${res.source}`);
    } finally {
      setSearchBusy(false);
    }
  }, [searchQ]);

  const pickSearchHit = useCallback(
    (hit: GeocodeHit) => {
      setSearchOpen(false);
      setSearchHits([]);
      setSearchQ(hit.label);
      proposeDestination(hit.lat, hit.lon, hit.label);
      setHudNote(`Destination · ${hit.label}`);
    },
    [proposeDestination],
  );

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
      // Soft cloud — ok:false is fine; pins stay local.
      void reportHazard({
        reporterUid: 'local',
        kind: 'radar',
        lat: origin.lat,
        lon: origin.lon,
        note: 'Police (crowd)',
        expiresAt: local.report.expiresAt,
      });
      setHudNote('Police signalé (local · ~45 min) — pas d’outil de harcèlement');
      void refreshLayers();
    })();
  }, [gpsOk, refreshLayers]);

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
            placeholder="Adresse / lieu…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => void runSearch()}
            accessibilityLabel="Recherche adresse"
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
            keyExtractor={(item, i) => `${item.lat},${item.lon},${i}`}
            style={styles.hits}
            renderItem={({ item }) => (
              <Pressable style={styles.hitRow} onPress={() => pickSearchHit(item)}>
                <Text style={styles.hitTxt} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        ) : null}
      </View>

      {hudNote ? (
        <View
          pointerEvents="none"
          style={[
            styles.note,
            {
              top: chromePads.padTop + 108,
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

      <View
        style={[
          styles.reportRow,
          {
            bottom: chromePads.padBottom + 8,
            left: chromePads.padLeft + 4,
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable style={styles.reportBtn} onPress={dropPoliceReport}>
          <Text style={styles.reportTxt}>Police</Text>
        </Pressable>
        {lastRoute?.ok ? (
          <Text style={styles.etaTxt} numberOfLines={1}>
            ~{lastRoute.durationMin} min · {lastRoute.distanceKm} km
          </Text>
        ) : null}
      </View>
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
    maxHeight: 160,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 11,
  },
  hitRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  hitTxt: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  note: {
    position: 'absolute',
    backgroundColor: 'rgba(27,36,48,0.9)',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  noteTxt: { color: colors.white, fontSize: 11, fontWeight: '600', lineHeight: 15 },
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
});
