import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { MOCK_FEED } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { colors } from '../../src/theme/colors';

/** Module 12 — Fil mécanique. */
export default function FilMecaniqueScreen() {
  useModuleVisit(12);
  const [posts, setPosts] = useState(MOCK_FEED);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setPosts((p) => [
        {
          id: `fp-${Date.now()}`,
          author: 'Vous',
          title: 'Actualisation rapide',
          caption: 'Nouveau post mock après pull-to-refresh.',
          likes: 0,
          comments: 0,
          createdAt: new Date().toISOString(),
        },
        ...p,
      ]);
      setRefreshing(false);
    }, 600);
  };

  return (
    <Screen title="Fil mécanique" subtitle="Module 12 — réseau social vidéo (structure mock)">
      <Pressable style={styles.refreshBar} onPress={onRefresh}>
        <Text style={styles.refreshTxt}>↓ Actualiser le fil</Text>
      </Pressable>
      <View>
        {posts.map((p) => (
          <Card key={p.id} title={p.title}>
            <Text style={styles.meta}>
              {p.author} · {new Date(p.createdAt).toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.caption}>{p.caption}</Text>
            <Text style={styles.stats}>
              ♥ {p.likes} · 💬 {p.comments} · [vidéo mock]
            </Text>
            <Pressable style={styles.comment}>
              <Text style={styles.commentTxt}>Commentaires d’entraide (local)</Text>
            </Pressable>
          </Card>
        ))}
      </View>
      {/* RefreshControl needs ScrollView; Screen already scrolls — trigger via bar above */}
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  refreshBar: {
    backgroundColor: colors.garageSoft,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.garage,
  },
  refreshTxt: { color: colors.garage, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12 },
  caption: { color: colors.slate },
  stats: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  comment: { paddingTop: 4 },
  commentTxt: { color: colors.signal, fontWeight: '700', fontSize: 13 },
});
