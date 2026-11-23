import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { MOCK_FEED } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import type { FeedPost } from '../../src/types/modules';
import { colors } from '../../src/theme/colors';

/** Module 12 — Fil mécanique (feed + refresh + upload stub clair). */
export default function FilMecaniqueScreen() {
  useModuleVisit(12);
  const [posts, setPosts] = useState<FeedPost[]>(MOCK_FEED);
  const [refreshing, setRefreshing] = useState(false);
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setPosts((p) => [
        {
          id: `fp-${Date.now()}`,
          author: 'Fil live (mock)',
          title: 'Actualisation rapide',
          caption: 'Nouveau conseil après pull-to-refresh — structure réseau social mécanique.',
          likes: 0,
          comments: 0,
          createdAt: new Date().toISOString(),
        },
        ...p,
      ]);
      setRefreshing(false);
    }, 500);
  };

  const tryUpload = () => {
    setUploadMsg(
      'Publication vidéo non branchée — aucun upload réussi. Branchez stockage / CDN avant d’envoyer des clips.',
    );
  };

  const toggleLike = (id: string) => {
    setLiked((prev) => {
      const next = !prev[id];
      setPosts((ps) =>
        ps.map((p) =>
          p.id === id ? { ...p, likes: Math.max(0, p.likes + (next ? 1 : -1)) } : p,
        ),
      );
      return { ...prev, [id]: next };
    });
  };

  const addComment = (id: string) => {
    if (!draft.trim()) return;
    setPosts((ps) =>
      ps.map((p) => (p.id === id ? { ...p, comments: p.comments + 1 } : p)),
    );
    setDraft('');
    setCommentOpen(null);
  };

  return (
    <Screen
      title="Fil mécanique"
      subtitle="Module 12 — réseau social vidéo (structure locale)"
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <StubBanner text="STUB — upload vidéo / CDN non branchés ; commentaires & likes locaux uniquement" />

      <Pressable style={styles.refreshBar} onPress={onRefresh}>
        <Text style={styles.refreshTxt}>↓ Actualiser le fil</Text>
      </Pressable>

      <Card title="Publier une réparation">
        <Text style={styles.meta}>
          Conducteurs et garagistes : partagez pannes, conseils et clips. Aucune vidéo stockée tant que
          l’upload n’est pas configuré.
        </Text>
        <Pressable style={styles.upload} onPress={tryUpload}>
          <Text style={styles.uploadTxt}>Choisir une vidéo (stub)</Text>
        </Pressable>
        {uploadMsg ? <Text style={styles.warn}>{uploadMsg}</Text> : null}
      </Card>

      {posts.map((p) => (
        <Card key={p.id} title={p.title}>
          <Text style={styles.meta}>
            {p.author} · {new Date(p.createdAt).toLocaleString('fr-FR')}
          </Text>
          <Text style={styles.caption}>{p.caption}</Text>
          <View style={styles.statsRow}>
            <Pressable onPress={() => toggleLike(p.id)}>
              <Text style={[styles.stats, liked[p.id] && styles.liked]}>
                ♥ {p.likes} {liked[p.id] ? '· aimé' : ''}
              </Text>
            </Pressable>
            <Text style={styles.stats}>💬 {p.comments}</Text>
            <Text style={styles.statsMuted}>[aperçu vidéo mock]</Text>
          </View>
          <Pressable style={styles.comment} onPress={() => setCommentOpen(commentOpen === p.id ? null : p.id)}>
            <Text style={styles.commentTxt}>
              {commentOpen === p.id ? 'Fermer commentaires' : 'Commentaires d’entraide'}
            </Text>
          </Pressable>
          {commentOpen === p.id ? (
            <View style={styles.commentBox}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Écrire un conseil…"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Pressable style={styles.send} onPress={() => addComment(p.id)}>
                <Text style={styles.uploadTxt}>Envoyer</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>
      ))}
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
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  stats: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  liked: { color: colors.danger },
  statsMuted: { color: colors.muted, fontSize: 11 },
  comment: { paddingTop: 4 },
  commentTxt: { color: colors.signal, fontWeight: '700', fontSize: 13 },
  commentBox: { gap: 8, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
  },
  upload: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  send: { backgroundColor: colors.signal, borderRadius: 10, padding: 10, alignItems: 'center' },
  uploadTxt: { color: colors.white, fontWeight: '800' },
  warn: { color: colors.warn, fontWeight: '700', fontSize: 12, marginTop: 8 },
});
