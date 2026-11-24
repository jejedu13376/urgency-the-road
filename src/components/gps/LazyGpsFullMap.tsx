import { lazy, Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';

/**
 * Code-split the Leaflet/WebView map shell so non-Carte tabs and startup
 * do not pay for GpsFullMap + geo stack until the map actually mounts.
 */
const GpsFullMap = lazy(() =>
  import('./GpsFullMap').then((m) => ({ default: m.GpsFullMap })),
);

function MapFallback() {
  return (
    <View style={styles.fallback} accessibilityLabel="Chargement carte">
      <ActivityIndicator color={colors.signal} size="large" />
    </View>
  );
}

export function LazyGpsFullMap() {
  return (
    <Suspense fallback={<MapFallback />}>
      <GpsFullMap />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: colors.asphalt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
