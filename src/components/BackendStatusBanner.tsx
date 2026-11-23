import { StyleSheet, Text, View } from 'react-native';
import { firebaseStatusLabel, isFirebaseConfigured } from '../firebase/config';
import { isYoutubeApiConfigured } from '../services/youtube/youtubeSearch';
import { colors } from '../theme/colors';

/** Shows Firebase + YouTube env readiness (keys from .env only). */
export function BackendStatusBanner() {
  const fb = isFirebaseConfigured();
  const yt = isYoutubeApiConfigured();
  const live = fb;
  const line = [
    firebaseStatusLabel(),
    yt ? 'YouTube API clé OK' : 'YouTube — EXPO_PUBLIC_YOUTUBE_API_KEY manquant',
  ].join(' · ');

  return (
    <View style={[styles.wrap, live ? styles.live : styles.mock]}>
      <Text style={styles.txt}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  live: { backgroundColor: colors.garageSoft, borderWidth: 1, borderColor: colors.garage },
  mock: { backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: colors.warn },
  txt: { fontSize: 11, fontWeight: '700', color: colors.ink },
});
