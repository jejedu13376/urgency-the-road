import { StyleSheet, View } from 'react-native';
import { LazyGpsFullMap } from '../../src/components/gps/LazyGpsFullMap';
import { colors } from '../../src/theme/colors';

/**
 * Onglet Carte — carte plein écran GPS uniquement (voiture / camion).
 * Pas de hub M8/M9 ni autre contenu hors overlays HUD navigation.
 * GpsFullMap is lazy so other tabs skip the Leaflet/WebView graph.
 */
export default function CarteScreen() {
  return (
    <View style={styles.fill}>
      <LazyGpsFullMap />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.asphalt },
});
