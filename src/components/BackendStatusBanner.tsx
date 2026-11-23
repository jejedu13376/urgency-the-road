import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { firebaseStatusLabel, isFirebaseConfigured } from '../firebase/config';
import { isYoutubeApiConfigured } from '../services/youtube/youtubeSearch';
import { colors } from '../theme/colors';

/** Shows Firebase + YouTube env readiness (keys from .env only). */
export function BackendStatusBanner() {
  const { t } = useI18n();
  const fb = isFirebaseConfigured();
  const yt = isYoutubeApiConfigured();
  const live = fb;
  const line = [
    firebaseStatusLabel(),
    yt ? t('backend.youtubeOk') : t('backend.youtubeMissing'),
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
