import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { YoutubeVideoHit } from '../services/youtube/youtubeSearch';
import { colors } from '../theme/colors';

export function YoutubeSuggestions({
  items,
  statusLabel,
}: {
  items: YoutubeVideoHit[];
  statusLabel?: string;
}) {
  if (!items.length && !statusLabel) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Tutoriels YouTube (ouvrir l’app / le site)</Text>
      {statusLabel ? <Text style={styles.status}>{statusLabel}</Text> : null}
      {items.map((v) => (
        <Pressable
          key={v.videoId}
          style={styles.row}
          onPress={() => void Linking.openURL(v.watchUrl)}
          accessibilityRole="link"
          accessibilityLabel={`Ouvrir ${v.title} sur YouTube`}
        >
          <Text style={styles.link}>▶ {v.title}</Text>
          <Text style={styles.meta}>{v.channelTitle || v.videoId}</Text>
        </Pressable>
      ))}
      {!items.length ? (
        <Text style={styles.meta}>Aucune vidéo — vérifiez la clé API / quotas.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  status: { color: colors.muted, fontSize: 11 },
  row: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 2,
  },
  link: { color: colors.signal, fontWeight: '800', fontSize: 13 },
  meta: { color: colors.muted, fontSize: 11 },
});
