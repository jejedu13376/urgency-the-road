import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDeviceCoords } from '../services/geo/deviceLocation';
import { loadLocalPrefs } from '../services/prefs/localPrefs';
import { fetchWeather, type WeatherSnapshot } from '../services/weather/openMeteo';
import { colors } from '../theme/colors';

/** Top-right — leaves top-left free for permanent red spinner. Hidden on /modules/* (Stack header). */
export function WeatherBanner() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const onModules = pathname?.includes('/modules');
  const [enabled, setEnabled] = useState(true);
  const [w, setW] = useState<WeatherSnapshot | null>(null);
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const prefs = await loadLocalPrefs();
      if (!cancelled) setEnabled(prefs.showWeather);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!enabled || onModules) return;
    let cancelled = false;
    void (async () => {
      try {
        const coords = await getDeviceCoords({ allowFallback: true });
        const lat = coords.data?.lat;
        const lon = coords.data?.lon;
        const snap = await fetchWeather(lat, lon);
        const gpsBit =
          coords.data?.source === 'device'
            ? 'GPS appareil'
            : coords.data?.label ?? 'GPS fallback Lille';
        if (!cancelled) {
          setW({
            ...snap,
            label: `${snap.label} · ${gpsBit}`,
          });
        }
      } catch {
        if (!cancelled) {
          setW({
            tempC: 8,
            road: 'ouvertes',
            updatedAt: new Date().toISOString(),
            source: 'fallback',
            label: 'Météo soft-fail locale',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, onModules]);

  if (!enabled || onModules) return null;

  const temp = w?.tempC ?? '…';
  const road = w?.road ?? 'ouvertes';

  return (
    <View
      style={[styles.wrap, { top: Math.max(insets.top, 8), right: 10 }]}
      accessibilityLabel="Bandeau météo et état des routes"
    >
      <Text style={styles.main}>
        {date} · {time} · {temp}°C · routes {road}
      </Text>
      <Text style={styles.stub}>{w?.label ?? 'Météo…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 20,
    maxWidth: '58%',
    backgroundColor: 'rgba(16,24,32,0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  main: { color: colors.white, fontSize: 11, fontWeight: '600' },
  stub: { color: colors.mist, fontSize: 9, marginTop: 2 },
});
