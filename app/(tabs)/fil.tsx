import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { MOCK_FEED } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { createTextFeedPost, listFeedPosts } from '../../src/services/firebase/feedService';
import type { FeedPost } from '../../src/types/modules';
import { colors } from '../../src/theme/colors';

type LocalComment = { id: string; author: string; text: string; at: string };

/** Module 12 — Fil mécanique (feed + pull refresh + commentaires + upload stub clair). */
export default function FilMecaniqueScreen() {
  useModuleVisit(12);
  const [posts, setPosts] = useState<FeedPost[]>(MOCK_FEED);
  const [refreshing, setRefreshing] = useState(false);
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState<Record<string, LocalComment[]>>({
    fp1: [
      {
        id: 'c1',
        author: 'MécanoPaul',
        text: 'Couple 25 Nm et pâte neuve — tiens bon.',
        at: '2026-11-22T11:00:00Z',
      },
    ],
  });
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [captionDraft, setCaptionDraft] = useState('');
  const [feedLabel, setFeedLabel] = useState<string | undefined>();

  const loadFeed = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await listFeedPosts(40);
      if (res.data?.length) setPosts(res.data);
      setFeedLabel(
        res.stubLabel ?? (res.source === 'firebase' ? 'Fil Firestore LIVE' : undefined),
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const onRefresh = () => {
    void loadFeed();
  };

  const tryUpload = () => {
    setUploadMsg(
      'Publication vidéo non branchée — aucun upload réussi. Branchez stockage / CDN avant d’envoyer des clips. Aucune vidéo stockée dans l’app.',
    );
  };

  const publishCaption = async () => {
    if (!captionDraft.trim()) return;
    const res = await createTextFeedPost({
      title: 'Conseil mécanique',
      caption: captionDraft.trim(),
      authorName: 'Vous',
    });
    setUploadMsg(res.stubLabel ?? (res.ok ? 'Publié' : 'Échec publication'));
    if (res.data) {
      setPosts((p) => [res.data as FeedPost, ...p]);
      setCaptionDraft('');
    }
  };

  const toggleLike = (id: string) => {
    setLiked((prev) => {
      const next = !prev[id];
      setPosts((ps) =>
        ps.map((p) => (p.id === id ? { ...p, likes: Math.max(0, p.likes + (next ? 1 : -1)) } : p)),
      );
      return { ...prev, [id]: next };
    });
  };

  const addComment = (id: string) => {
    if (!draft.trim()) return;
    const entry: LocalComment = {
      id: `lc-${Date.now()}`,
      author: 'Vous',
      text: draft.trim(),
      at: new Date().toISOString(),
    };
    setComments((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), entry] }));
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, comments: p.comments + 1 } : p)));
    setDraft('');
  };

  return (
    <Screen
      title="Fil mécanique"
      subtitle="Module 12 — réseau social vidéo (structure locale)"
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <StubBanner text="Texte Firestore LIVE si Auth ; upload vidéo / CDN encore stub" />
      {feedLabel ? <Text style={styles.meta}>{feedLabel}</Text> : null}

      <Pressable style={styles.refreshBar} onPress={onRefresh}>
        <Text style={styles.refreshTxt}>
          {refreshing ? 'Actualisation…' : '↓ Actualiser le fil (pull ou tap)'}
        </Text>
      </Pressable>

      <Card title="Publier une réparation">
        <Text style={styles.meta}>
          Conducteurs et garagistes : partagez pannes, conseils et clips. Vidéo = CDN à brancher ;
          légende texte sync Firestore quand connecté.
        </Text>
        <TextInput
          value={captionDraft}
          onChangeText={setCaptionDraft}
          placeholder="Légende / conseil…"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Pressable style={styles.send} onPress={() => void publishCaption()}>
          <Text style={styles.uploadTxt}>Publier le texte</Text>
        </Pressable>
        <Pressable style={styles.upload} onPress={tryUpload}>
          <Text style={styles.uploadTxt}>Choisir une vidéo (stub CDN)</Text>
        </Pressable>
        {uploadMsg ? <Text style={styles.warn}>{uploadMsg}</Text> : null}
      </Card>

      {posts.map((p) => (
        <Card key={p.id} title={p.title}>
          <Text style={styles.meta}>
            {p.author} · {new Date(p.createdAt).toLocaleString('fr-FR')}
          </Text>
          <Text style={styles.caption}>{p.caption}</Text>
          <View style={styles.videoStub}>
            <Text style={styles.videoStubTxt}>[aperçu vidéo mock — pas de fichier embarqué]</Text>
          </View>
          <View style={styles.statsRow}>
            <Pressable onPress={() => toggleLike(p.id)}>
              <Text style={[styles.stats, liked[p.id] && styles.liked]}>
                ♥ {p.likes} {liked[p.id] ? '· aimé' : ''}
              </Text>
            </Pressable>
            <Text style={styles.stats}>💬 {p.comments}</Text>
          </View>
          <Pressable
            style={styles.comment}
            onPress={() => setCommentOpen(commentOpen === p.id ? null : p.id)}
          >
            <Text style={styles.commentTxt}>
              {commentOpen === p.id ? 'Fermer commentaires' : 'Commentaires d’entraide'}
            </Text>
          </Pressable>
          {commentOpen === p.id ? (
            <View style={styles.commentBox}>
              {(comments[p.id] ?? []).map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentAuthor}>{c.author}</Text>
                  <Text style={styles.caption}>{c.text}</Text>
                </View>
              ))}
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
  videoStub: {
    backgroundColor: colors.mist,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  videoStubTxt: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  stats: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  liked: { color: colors.danger },
  comment: { paddingTop: 4 },
  commentTxt: { color: colors.signal, fontWeight: '700', fontSize: 13 },
  commentBox: { gap: 8, marginTop: 6 },
  commentItem: {
    backgroundColor: colors.mist,
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  commentAuthor: { fontWeight: '800', color: colors.ink, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
  },
  upload: {
    backgroundColor: colors.asphalt,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  send: { backgroundColor: colors.signal, borderRadius: 10, padding: 10, alignItems: 'center' },
  uploadTxt: { color: colors.white, fontWeight: '800' },
  warn: { color: colors.warn, fontWeight: '700', fontSize: 12, marginTop: 8 },
});
