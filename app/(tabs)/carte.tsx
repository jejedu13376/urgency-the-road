import { StyleSheet, View } from 'react-native';
import { GpsFullMap } from '../../src/components/gps/GpsFullMap';
import { colors } from '../../src/theme/colors';

/**
 * Onglet Carte — carte plein écran GPS uniquement (voiture / camion).
 * Pas de hub M8/M9 ni autre contenu hors overlays HUD navigation.
 */
export default function CarteScreen() {
  return (
    <View style={styles.fill}>
      <GpsFullMap />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.asphalt },
});
