import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { MOCK_FEED } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  loadComments,
  loadLiked,
  saveComments,
  saveLiked,
  type LocalComment,
} from '../../src/services/feed/feedComments';
import { pickLocalVideo, VIDEO_CDN_BLOCKED } from '../../src/services/feed/pickLocalVideo';
import { createTextFeedPost, listFeedPosts } from '../../src/services/firebase/feedService';
import type { FeedPost } from '../../src/types/modules';
import { colors } from '../../src/theme/colors';

/** Module 12 — Fil mécanique texte (Firestore + commentaires locaux). Vidéo CDN = stub honnête. */
export default function FilMecaniqueScreen() {
  useModuleVisit(12);
  const { profile } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>(MOCK_FEED);
  const [refreshing, setRefreshing] = useState(false);
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState<Record<string, LocalComment[]>>({});
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [captionDraft, setCaptionDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('Conseil mécanique');
  const [feedLabel, setFeedLabel] = useState<string | undefined>();
  const [localVideoUri, setLocalVideoUri] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setComments(await loadComments());
      setLiked(await loadLiked());
    })();
  }, []);

  useEffect(() => {
    void saveComments(comments);
  }, [comments]);

  useEffect(() => {
    void saveLiked(liked);
  }, [liked]);

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

  const tryPickVideo = async () => {
    const pick = await pickLocalVideo();
    setUploadMsg(pick.label);
    if (pick.ok) {
      setLocalVideoUri(pick.uri);
      if (!captionDraft.trim()) {
        setCaptionDraft(
          `[vidéo locale]${pick.durationSec != null ? ` ~${pick.durationSec}s` : ''} — clip on-device, CDN non branché`,
        );
      }
    }
  };

  const publishCaption = async () => {
    if (!captionDraft.trim() && !localVideoUri) return;
    const caption =
      captionDraft.trim() ||
      (localVideoUri ? '[vidéo locale] — fichier on-device uniquement' : '');
    const res = await createTextFeedPost({
      title: titleDraft.trim() || (localVideoUri ? 'Clip réparation (local)' : 'Conseil mécanique'),
      caption,
      // Never publish email — feedPosts is world-readable
      authorName:
        profile?.displayName?.trim() ||
        (profile?.uid ? `Conducteur-${profile.uid.slice(0, 6)}` : 'Conducteur'),
    });
    setUploadMsg(
      localVideoUri
        ? `${res.stubLabel ?? (res.ok ? 'Publié (méta texte)' : 'Échec')} · ${VIDEO_CDN_BLOCKED}`
        : res.stubLabel ?? (res.ok ? 'Publié' : 'Échec publication'),
    );
    if (res.data) {
      const post: FeedPost = {
        ...(res.data as FeedPost),
        localMediaUri: localVideoUri ?? undefined,
        mediaKind: localVideoUri ? 'video_local' : 'text',
      };
      setPosts((p) => [post, ...p]);
      setCaptionDraft('');
      setLocalVideoUri(null);
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
      author:
        profile?.displayName?.trim() ||
        (profile?.uid ? `Conducteur-${profile.uid.slice(0, 6)}` : 'Conducteur'),
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
      subtitle="Module 12 — texte LIVE · vidéo CDN à brancher"
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <StubBanner text="Texte Firestore LIVE si Auth · pick vidéo locale · upload CDN = bloqué" />
      {feedLabel ? <Text style={styles.meta}>{feedLabel}</Text> : null}

      <Pressable style={styles.refreshBar} onPress={onRefresh}>
        <Text style={styles.refreshTxt}>
          {refreshing ? 'Actualisation…' : '↓ Actualiser le fil (pull ou tap)'}
        </Text>
      </Pressable>

      <Card title="Publier une réparation (texte)">
        <Text style={styles.meta}>
          Conducteurs et garagistes : partagez pannes et conseils. Vidéo = CDN à brancher ; légende
          texte sync Firestore quand connecté.
        </Text>
        <TextInput
          value={titleDraft}
          onChangeText={setTitleDraft}
          placeholder="Titre…"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <TextInput
          value={captionDraft}
          onChangeText={setCaptionDraft}
          placeholder="Légende / conseil…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
        />
        {localVideoUri ? (
          <Text style={styles.meta}>Vidéo locale prête (on-device) — ne sera pas uploadée.</Text>
        ) : null}
        <Pressable style={styles.send} onPress={() => void publishCaption()}>
          <Text style={styles.uploadTxt}>
            {localVideoUri ? 'Publier méta + légende (sans CDN)' : 'Publier le texte'}
          </Text>
        </Pressable>
        <Pressable style={styles.upload} onPress={() => void tryPickVideo()}>
          <Text style={styles.uploadTxt}>Choisir une vidéo locale</Text>
        </Pressable>
        {uploadMsg ? <Text style={styles.warn}>{uploadMsg}</Text> : null}
      </Card>

      {posts.map((p) => {
        const isLocalVideo =
          p.mediaKind === 'video_local' ||
          Boolean(p.localMediaUri) ||
          p.caption.toLowerCase().includes('[vidéo');
        return (
          <Card key={p.id} title={p.title}>
            <Text style={styles.meta}>
              {p.author} · {new Date(p.createdAt).toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.caption}>{p.caption}</Text>
            {isLocalVideo ? (
              <View style={styles.videoStub}>
                <Text style={styles.videoStubTxt}>
                  {p.localMediaUri
                    ? '[vidéo locale on-device — pas d’hébergement CDN]'
                    : '[réf. vidéo — CDN non branché · pas de fichier embarqué]'}
                </Text>
              </View>
            ) : (
              <View style={styles.textBadge}>
                <Text style={styles.textBadgeTxt}>Publication texte</Text>
              </View>
            )}
            <View style={styles.statsRow}>
              <Pressable onPress={() => toggleLike(p.id)}>
                <Text style={[styles.stats, liked[p.id] && styles.liked]}>
                  ♥ {p.likes} {liked[p.id] ? '· aimé' : ''}
                </Text>
              </Pressable>
              <Text style={styles.stats}>💬 {p.comments + (comments[p.id]?.length ?? 0)}</Text>
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
        );
      })}
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
  textBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.garageSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginVertical: 6,
  },
  textBadgeTxt: { color: colors.garage, fontSize: 11, fontWeight: '800' },
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
    marginTop: 6,
  },
  upload: {
    backgroundColor: colors.asphalt,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  send: { backgroundColor: colors.signal, borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 8 },
  uploadTxt: { color: colors.white, fontWeight: '800' },
  warn: { color: colors.warn, fontWeight: '700', fontSize: 12, marginTop: 8 },
});
