import { StyleSheet, Text, View } from 'react-native';
import { fr } from '../i18n/fr';
import { stubWeather } from '../services/stubs';
import { colors } from '../theme/colors';

export function WeatherBanner() {
  const w = stubWeather().data;
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.wrap} accessibilityLabel="Bandeau météo et état des routes">
      <Text style={styles.main}>
        {date} · {time} · {w.tempC}°C · routes {w.road}
      </Text>
      <Text style={styles.stub}>{fr.stubWeather}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 20,
    maxWidth: '72%',
    backgroundColor: 'rgba(16,24,32,0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomRightRadius: 12,
  },
  main: { color: colors.white, fontSize: 11, fontWeight: '600' },
  stub: { color: '#C9D3DC', fontSize: 9, marginTop: 2 },
});
