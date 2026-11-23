import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView as RNWebView, type WebViewMessageEvent } from 'react-native-webview';
import { useFleet } from '../../context/FleetContext';
import { getDeviceCoords } from '../../services/geo/deviceLocation';
import {
  fetchVehicleRoute,
  mapsHandoffUrls,
  type VehicleRouteResult,
} from '../../services/geo/valhallaRoute';
import { fetchNearbyBridgeClearances } from '../../services/osm/overpassPlaces';
import {
  loadGpsNavPrefs,
  saveGpsNavPrefs,
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
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  allowFileAccess?: boolean;
  mixedContentMode?: string;
  setSupportMultipleWindows?: boolean;
  geolocationEnabled?: boolean;
}>;

type MapWindow = Window & {
  __gpsApplyRoute?: (payload: VehicleRouteResult) => void;
  __gpsSetOrigin?: (lat: number, lon: number) => void;
};

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

/**
 * Full-bleed GPS map (OSM/Leaflet). Only HUD overlays — no hub cards.
 * Tap → voiture/camion (logo camion) → Valhalla route → vehicle icon animates.
 */
export function GpsFullMap() {
  const insets = useSafeAreaInsets();
  const { active } = useFleet();
  const webRef = useRef<WebViewHandle | null>(null);
  const iframeWinRef = useRef<MapWindow | null>(null);
  /** Monotonic id so a slower older Valhalla response cannot overwrite a newer route. */
  const routeReqId = useRef(0);
  const [bootHtml, setBootHtml] = useState<string | null>(null);
  const [hudNote, setHudNote] = useState<string | null>(null);
  const [lastRoute, setLastRoute] = useState<VehicleRouteResult | null>(null);
  const [dest, setDest] = useState<{ lat: number; lon: number } | null>(null);
  const [modeLabel, setModeLabel] = useState<GpsVehicleMode>('voiture');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadGpsNavPrefs();
      const isPl =
        active?.vehicleClass === 'poids_lourd' || active?.powertrain === 'poids_lourd_diesel';
      const initial =
        stored.updatedAt === new Date(0).toISOString() && isPl
          ? await saveGpsNavPrefs({ mode: 'camion' })
          : stored;
      const loc = await getDeviceCoords({ allowFallback: true });
      if (cancelled) return;
      const origin = loc.data
        ? { lat: loc.data.lat, lon: loc.data.lon }
        : { lat: 50.6292, lon: 3.0573 };
      setModeLabel(initial.mode);
      setBootHtml(
        buildGpsMapHtml({
          lat: origin.lat,
          lon: origin.lon,
          mode: initial.mode,
          truckHeightM: initial.truckHeightM,
          truckWidthM: initial.truckWidthM,
          truckPtacT: initial.truckPtacT,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [active?.vehicleClass, active?.powertrain]);

  const injectRoute = useCallback((result: VehicleRouteResult) => {
    if (Platform.OS === 'web') {
      try {
        iframeWinRef.current?.__gpsApplyRoute?.(result);
      } catch {
        /* ignore */
      }
      return;
    }
    webRef.current?.injectJavaScript(
      `window.__gpsApplyRoute && window.__gpsApplyRoute(${JSON.stringify(result)}); true;`,
    );
  }, []);

  const setMapOrigin = useCallback((lat: number, lon: number) => {
    if (Platform.OS === 'web') {
      try {
        iframeWinRef.current?.__gpsSetOrigin?.(lat, lon);
      } catch {
        /* ignore */
      }
      return;
    }
    webRef.current?.injectJavaScript(
      `window.__gpsSetOrigin && window.__gpsSetOrigin(${lat},${lon}); true;`,
    );
  }, []);

  const handleMapMsg = useCallback(
    (raw: string) => {
      let msg: MapMsg;
      try {
        msg = JSON.parse(raw) as MapMsg;
      } catch {
        return;
      }

      if (msg.type === 'mode') {
        setModeLabel(msg.mode);
        void saveGpsNavPrefs({ mode: msg.mode });
        setHudNote(msg.mode === 'camion' ? 'Mode camion enregistré' : 'Mode voiture enregistré');
        return;
      }

      if (msg.type === 'recenter') {
        void (async () => {
          const loc = await getDeviceCoords({ allowFallback: true });
          if (!loc.data) return;
          setMapOrigin(loc.data.lat, loc.data.lon);
        })();
        return;
      }

      if (msg.type === 'route') {
        setDest(msg.to);
        setModeLabel(msg.mode);
        const reqId = ++routeReqId.current;
        void (async () => {
          await saveGpsNavPrefs({
            mode: msg.mode,
            truckHeightM: msg.truck.heightM,
            truckWidthM: msg.truck.widthM,
            truckPtacT: msg.truck.weightT,
          });
          if (reqId !== routeReqId.current) return;

          const route = await fetchVehicleRoute(msg.from, msg.to, msg.mode, {
            heightM: msg.truck.heightM,
            widthM: msg.truck.widthM,
            weightT: msg.truck.weightT,
          });
          if (reqId !== routeReqId.current) return;

          let label = route.label;
          if (msg.mode === 'camion' && route.ok) {
            const mid = route.coords[Math.floor(route.coords.length / 2)] ?? [
              msg.from.lat,
              msg.from.lon,
            ];
            const bridges = await fetchNearbyBridgeClearances(mid[0], mid[1], 12000);
            if (reqId !== routeReqId.current) return;
            const risky = bridges.bridges.filter(
              (b) => b.maxheightM != null && b.maxheightM < (msg.truck.heightM || 4),
            );
            if (risky.length) {
              label = `${route.label} · ⚠ ${risky.length} ouvrage(s) maxheight < ${msg.truck.heightM} m (OSM advisory)`;
            } else if (bridges.label) {
              label = `${route.label} · ${bridges.label}`;
            }
          }

          if (reqId !== routeReqId.current) return;
          const enriched = { ...route, label };
          setLastRoute(enriched);
          setHudNote(label);
          injectRoute(enriched);
        })();
        return;
      }

      if (msg.type === 'navigating' && msg.to) {
        setDest(msg.to);
        const urls = mapsHandoffUrls(msg.to, msg.mode);
        setHudNote(
          msg.mode === 'camion'
            ? `Navigation camion (anim) — ${urls.truckNote}`
            : 'Navigation voiture (animation sur carte)',
        );
        return;
      }

      if (msg.type === 'arrived' && msg.to) {
        setDest(msg.to);
        // Preview only — do not auto-open Maps; user taps Maps/Waze HUD.
        setHudNote('Arrivée animée — tapez Maps / Waze pour le guidage live');
      }
    },
    [injectRoute, setMapOrigin],
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
      // Only accept messages from our map iframe (srcDoc → opaque/null origin).
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
          originWhitelist={['*']}
          source={{
            html: bootHtml,
            baseUrl: Platform.OS === 'android' ? 'https://localhost' : undefined,
          }}
          style={styles.fill}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          geolocationEnabled
        />
      )}
      {hudNote ? (
        <View pointerEvents="none" style={[styles.note, { top: Math.max(insets.top, 8) + 72 }]}>
          <Text style={styles.noteTxt} numberOfLines={3}>
            {hudNote}
          </Text>
        </View>
      ) : null}
      {lastRoute?.ok && dest ? (
        <View
          style={[styles.handrow, { bottom: Math.max(insets.bottom, 8) + 70 }]}
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

/** Web-only iframe host — keeps ref write out of parent render props object. */
function WebIframe({
  html,
  onReady,
}: {
  html: string;
  onReady: (win: MapWindow | null) => void;
}) {
  return (
    // DOM iframe — web target only
    <iframe
      title="Carte GPS"
      srcDoc={html}
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
    left: 12,
    right: 12,
    backgroundColor: 'rgba(27,36,48,0.88)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteTxt: { color: colors.white, fontSize: 11, fontWeight: '600', lineHeight: 15 },
  handrow: {
    position: 'absolute',
    right: 12,
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
