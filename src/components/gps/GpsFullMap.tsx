import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView as RNWebView, type WebViewMessageEvent } from 'react-native-webview';
import { useFleet } from '../../context/FleetContext';
import { useI18n } from '../../context/I18nContext';
import { getGpsMapI18n } from '../../i18n';
import { getDeviceCoords } from '../../services/geo/deviceLocation';
import {
  fetchVehicleRoute,
  mapsHandoffUrls,
  type VehicleRouteResult,
} from '../../services/geo/valhallaRoute';
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
  // baseUrl used by RN WebView for the inline HTML document only
  if (url === 'https://localhost/' || url === 'https://localhost') return true;
  return false;
}

/** Origins allowed to host the inline map document (not a catch-all *). */
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

/** Parent → sandboxed map iframe (opaque/null origin — no contentWindow API access). */
function postGpsCmd(win: MapWindow | null, cmd: Record<string, unknown>) {
  if (!win) return;
  try {
    win.postMessage(JSON.stringify({ __gps: 1, ...cmd }), '*');
  } catch {
    /* ignore */
  }
}

/**
 * Full-bleed GPS map (OSM/Leaflet). Only HUD overlays — no hub cards.
 * Tap → voiture/camion (logo camion) → Valhalla route → vehicle icon animates.
 */
export function GpsFullMap() {
  const insets = useSafeAreaInsets();
  const { active } = useFleet();
  const { t, locale } = useI18n();
  const webRef = useRef<WebViewHandle | null>(null);
  const iframeWinRef = useRef<MapWindow | null>(null);
  const routeReqId = useRef(0);
  const prefsRef = useRef<GpsNavPrefs | null>(null);
  const bootedRef = useRef(false);
  /** Skip first vehicle-effect run (map boot) — only react to real fleet changes. */
  const fleetKeyRef = useRef<string | null>(null);
  const [bootHtml, setBootHtml] = useState<string | null>(null);
  const [hudNote, setHudNote] = useState<string | null>(null);
  const [lastRoute, setLastRoute] = useState<VehicleRouteResult | null>(null);
  const [dest, setDest] = useState<{ lat: number; lon: number } | null>(null);
  const [modeLabel, setModeLabel] = useState<GpsVehicleMode>('voiture');
  const [gpsOk, setGpsOk] = useState(false);
  /** Survive locale remount — re-inject into the new WebView on map `ready`. */
  const lastRouteRef = useRef<VehicleRouteResult | null>(null);
  const destRef = useRef<{ lat: number; lon: number } | null>(null);
  lastRouteRef.current = lastRoute;
  destRef.current = dest;

  const chromePads = useMemo<ChromePads>(
    () => ({
      padTop: Math.max(insets.top, 8) + 4,
      padRight: Math.max(insets.right, 8),
      // Status bar / safe area + SOS FAB clearance (right FAB at bottom ~92)
      padBottom: Math.max(insets.bottom, 8) + SOS_FAB_CLEARANCE,
      padLeft: Math.max(insets.left, 8),
    }),
    [insets.top, insets.right, insets.bottom, insets.left],
  );

  const injectRoute = useCallback((result: VehicleRouteResult) => {
    if (Platform.OS === 'web') {
      postGpsCmd(iframeWinRef.current, { cmd: 'applyRoute', payload: result });
      return;
    }
    webRef.current?.injectJavaScript(
      `window.__gpsApplyRoute && window.__gpsApplyRoute(${JSON.stringify(result)}); true;`,
    );
  }, []);

  const setMapOrigin = useCallback((lat: number, lon: number, ok: boolean) => {
    if (Platform.OS === 'web') {
      postGpsCmd(iframeWinRef.current, { cmd: 'setOrigin', lat, lon, ok });
      return;
    }
    webRef.current?.injectJavaScript(
      `window.__gpsSetOrigin && window.__gpsSetOrigin(${lat},${lon},${ok ? 'true' : 'false'}); true;`,
    );
  }, []);

  const applyModeInMap = useCallback((mode: GpsVehicleMode, prefs: GpsNavPrefs) => {
    const truck = {
      heightM: prefs.truckHeightM,
      widthM: prefs.truckWidthM,
      weightT: prefs.truckPtacT,
    };
    if (Platform.OS === 'web') {
      postGpsCmd(iframeWinRef.current, { cmd: 'applyMode', mode, truck });
      return;
    }
    webRef.current?.injectJavaScript(
      `window.__gpsApplyMode && window.__gpsApplyMode(${JSON.stringify(mode)}, ${JSON.stringify(truck)}); true;`,
    );
  }, []);

  /** Boot map on mount + language change — never remount on vehicle class change. */
  useEffect(() => {
    let cancelled = false;
    bootedRef.current = false;
    fleetKeyRef.current = null;
    // Drop in-flight Valhalla work so a late response cannot paint the new WebView.
    routeReqId.current += 1;
    void (async () => {
      const stored = await loadGpsNavPrefs();
      const isPl =
        active?.vehicleClass === 'poids_lourd' || active?.powertrain === 'poids_lourd_diesel';
      const initial =
        stored.updatedAt === new Date(0).toISOString() && isPl
          ? await saveGpsNavPrefs({ mode: 'camion' })
          : stored;

      // Never treat Lille fallback as silent device origin.
      const loc = await getDeviceCoords({ allowFallback: false });
      if (cancelled) return;

      const deviceOk = loc.ok === true && loc.data?.source === 'device';
      const origin = deviceOk
        ? { lat: loc.data.lat, lon: loc.data.lon }
        : { lat: 46.5, lon: 2.5 }; // neutral FR overview — not claimed as GPS

      prefsRef.current = initial;
      setModeLabel(initial.mode);
      setGpsOk(deviceOk);
      // Keep lastRoute/dest across locale remount (Maps/Waze + polyline restore on `ready`).
      if (!deviceOk) {
        setHudNote(
          loc.ok === false
            ? t('gps.gpsDeniedWithError', { error: loc.error ?? '' })
            : t('gps.gpsRequired'),
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
          i18n: getGpsMapI18n(),
          ...chromePads,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
    // Remount when locale changes so Leaflet HUD strings refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  /** Vehicle class / powertrain change → update icon without wiping map or clobbering GPS HUD. */
  useEffect(() => {
    if (!bootedRef.current || !bootHtml) return;
    const key = `${active?.vehicleClass ?? ''}|${active?.powertrain ?? ''}`;
    // First run is map-ready, not a fleet change — seed key and exit.
    if (fleetKeyRef.current === null) {
      fleetKeyRef.current = key;
      return;
    }
    if (fleetKeyRef.current === key) return;
    fleetKeyRef.current = key;

    void (async () => {
      const prefs = prefsRef.current ?? (await loadGpsNavPrefs());
      // Respect stored voiture/camion — never force camion over an explicit voiture choice.
      const nextMode: GpsVehicleMode = prefs.mode;
      setModeLabel(nextMode);
      applyModeInMap(nextMode, prefs);
      // No HUD toast on fleet/mode sync — orange chip selection is enough.
    })();
  }, [active?.vehicleClass, active?.powertrain, bootHtml, applyModeInMap]);

  /** Push safe-area / SOS clearance into map HUD without remount. */
  useEffect(() => {
    if (!bootHtml) return;
    if (Platform.OS === 'web') {
      postGpsCmd(iframeWinRef.current, { cmd: 'setChrome', pads: chromePads });
      return;
    }
    webRef.current?.injectJavaScript(
      `window.__gpsSetChrome && window.__gpsSetChrome(${JSON.stringify(chromePads)}); true;`,
    );
  }, [bootHtml, chromePads]);

  const handleMapMsg = useCallback(
    (raw: string) => {
      const msg = parseMapMsg(raw);
      if (!msg) return;

      if (msg.type === 'ready') {
        setModeLabel(msg.mode);
        const kept = lastRouteRef.current;
        const keptDest = destRef.current;
        if (kept?.ok && keptDest) {
          setDest(keptDest);
          setLastRoute(kept);
          if (kept.label) setHudNote(kept.label);
          // Defer one tick so WebView/iframe handlers are registered.
          setTimeout(() => injectRoute(kept), 0);
        }
        return;
      }

      if (msg.type === 'mode') {
        setModeLabel(msg.mode);
        void saveGpsNavPrefs({ mode: msg.mode }).then((p) => {
          prefsRef.current = p;
        });
        // Orange chip selection only — no "mode … enregistré" HUD spam.
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
                ? t('gps.gpsDeniedWithError', { error: loc.error ?? '' })
                : t('gps.needGpsAuthorize'),
            );
            setMapOrigin(46.5, 2.5, false);
            return;
          }
          setHudNote(t('gps.gpsOk'));
          setMapOrigin(loc.data.lat, loc.data.lon, true);
        })();
        return;
      }

      if (msg.type === 'route') {
        if (!gpsOk) {
          setHudNote(t('gps.routeBlockedNoFallback'));
          return;
        }
        setDest(msg.to);
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

          const route = await fetchVehicleRoute(msg.from, msg.to, msg.mode, {
            heightM: msg.truck.heightM,
            widthM: msg.truck.widthM,
            weightT: msg.truck.weightT,
          });
          if (reqId !== routeReqId.current) return;
          // No gabarit / maxheight alert banner in HUD — route label only (distance/time).
          setLastRoute(route);
          setHudNote(route.label);
          injectRoute(route);
        })();
        return;
      }

      if (msg.type === 'navigating' && msg.to) {
        setDest(msg.to);
        const urls = mapsHandoffUrls(msg.to, msg.mode);
        setHudNote(
          msg.mode === 'camion'
            ? t('gps.navTruckAnim', { note: urls.truckNote ?? '' })
            : t('gps.navCarAnim'),
        );
        return;
      }

      if (msg.type === 'arrived' && msg.to) {
        setDest(msg.to);
        setHudNote(t('gps.arrivedHud'));
      }
    },
    [gpsOk, injectRoute, setMapOrigin, t],
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

  if (!bootHtml) {
    return (
      <View style={[styles.fill, styles.boot]}>
        <Text style={styles.bootTxt}>{t('gps.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill} accessibilityLabel={t('gps.a11y', { mode: modeLabel })}>
      {Platform.OS === 'web' ? (
        <WebIframe
          title={t('gps.iframeTitle')}
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
            // Must match whitelist so the inline document loads (not Linking.openURL).
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
      {hudNote ? (
        <View
          pointerEvents="none"
          style={[
            styles.note,
            {
              top: chromePads.padTop + 64,
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
      {lastRoute?.ok && dest ? (
        <View
          style={[
            styles.handrow,
            {
              bottom: chromePads.padBottom + 8,
              right: chromePads.padRight + 4,
            },
          ]}
          pointerEvents="box-none"
        >
          <Text
            style={styles.handLink}
            onPress={() => void Linking.openURL(mapsHandoffUrls(dest, lastRoute.mode).google)}
          >
            Maps
          </Text>
          <Text
            style={styles.handLink}
            onPress={() => void Linking.openURL(mapsHandoffUrls(dest, lastRoute.mode).waze)}
          >
            Waze
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function WebIframe({
  html,
  title,
  onReady,
}: {
  html: string;
  title: string;
  onReady: (win: MapWindow | null) => void;
}) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      // No allow-same-origin → opaque unique origin; unpkg/Leaflet cannot read parent storage.
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
  note: {
    position: 'absolute',
    backgroundColor: 'rgba(27,36,48,0.88)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteTxt: { color: colors.white, fontSize: 11, fontWeight: '600', lineHeight: 15 },
  handrow: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 8,
  },
  handLink: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    color: colors.ink,
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
