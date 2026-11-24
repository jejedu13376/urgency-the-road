import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/context/I18nContext';
import { MOCK_FEED } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  loadComments,
  loadLiked,
  saveComments,
  saveLiked,
  type LocalComment,
} from '../../src/services/feed/feedComments';
import { pickLocalVideo, VIDEO_CDN_READY } from '../../src/services/feed/pickLocalVideo';
import { uploadFeedVideo } from '../../src/services/feed/uploadFeedVideo';
import { createTextFeedPost, listFeedPosts } from '../../src/services/firebase/feedService';
import type { FeedPost } from '../../src/types/modules';
import { colors } from '../../src/theme/colors';

/** Module 12 — Fil mécanique texte + upload CDN Storage (soft-fail). */
export default function FilMecaniqueScreen() {
  const { t } = useI18n();
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
  const [localVideoName, setLocalVideoName] = useState<string | undefined>();
  const [uploadingCdn, setUploadingCdn] = useState(false);

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
      // Success (live or intentional mock): apply payload. On ok:false keep prior posts
      // (or empty) — never swap real→fake under an empty/error banner.
      if (res.ok !== false && Array.isArray(res.data)) {
        setPosts(res.data);
      }
      setFeedLabel(
        res.stubLabel ?? (res.source === 'firebase' ? 'Fil Firestore LIVE' : undefined),
      );
    } catch (e) {
      setFeedLabel(e instanceof Error ? `Fil soft — ${e.message}` : 'Fil soft — erreur');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadFeed();
    }, 0);
    return () => clearTimeout(t);
  }, [loadFeed]);

  const onRefresh = () => {
    void loadFeed();
  };

  const tryPickVideo = async () => {
    const pick = await pickLocalVideo();
    setUploadMsg(pick.label);
    if (pick.ok) {
      setLocalVideoUri(pick.uri);
      setLocalVideoName(pick.fileName);
      if (!captionDraft.trim()) {
        setCaptionDraft(
          `[vidéo]${pick.durationSec != null ? ` ~${pick.durationSec}s` : ''} — clip prêt (CDN si Auth + rules)`,
        );
      }
    }
  };

  const publishCaption = async () => {
    if (!captionDraft.trim() && !localVideoUri) return;
    let remoteMediaUrl: string | undefined;
    let cdnNote = '';
    if (localVideoUri) {
      setUploadingCdn(true);
      try {
        const cdn = await uploadFeedVideo({
          localUri: localVideoUri,
          fileName: localVideoName,
        });
        cdnNote = cdn.stubLabel ?? (cdn.ok ? 'CDN OK' : 'CDN soft-fail');
        if (cdn.ok && cdn.data?.downloadUrl) {
          remoteMediaUrl = cdn.data.downloadUrl;
        }
      } finally {
        setUploadingCdn(false);
      }
    }
    // Always embed CDN URL in caption when present so reload stays honest even if fields lag.
    let caption = captionDraft.trim();
    if (remoteMediaUrl && !caption.includes(remoteMediaUrl)) {
      caption = caption
        ? `${caption}\n[vidéo CDN] ${remoteMediaUrl}`
        : `[vidéo CDN] ${remoteMediaUrl}`;
    } else if (!caption && localVideoUri) {
      caption = '[vidéo locale] — fichier on-device (CDN soft-fail)';
    }
    const mediaKind: FeedPost['mediaKind'] = remoteMediaUrl
      ? 'video_cdn'
      : localVideoUri
        ? 'video_local'
        : 'text';
    const res = await createTextFeedPost({
      title:
        titleDraft.trim() ||
        (remoteMediaUrl ? 'Clip réparation (CDN)' : localVideoUri ? 'Clip réparation (local)' : 'Conseil mécanique'),
      caption,
      remoteMediaUrl,
      mediaKind,
      // Never publish email — feedPosts is world-readable
      authorName:
        profile?.displayName?.trim() ||
        (profile?.uid ? `Conducteur-${profile.uid.slice(0, 6)}` : 'Conducteur'),
    });
    setUploadMsg(
      localVideoUri
        ? `${res.stubLabel ?? (res.ok ? 'Publié' : 'Échec')} · ${cdnNote}`
        : res.stubLabel ?? (res.ok ? 'Publié' : 'Échec publication'),
    );
    // Only clear the local clip after a real publish success — soft-fail keeps
    // the file so the user can retry (CDN object would otherwise be orphaned).
    if (res.ok && res.data) {
      const post: FeedPost = {
        ...(res.data as FeedPost),
        localMediaUri: localVideoUri ?? undefined,
        remoteMediaUrl: remoteMediaUrl ?? res.data.remoteMediaUrl,
        mediaKind: remoteMediaUrl ? 'video_cdn' : res.data.mediaKind ?? mediaKind,
      };
      setPosts((p) => [post, ...p]);
      setCaptionDraft('');
      setTitleDraft('');
      setLocalVideoUri(null);
      setLocalVideoName(undefined);
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
      title={t('fil.title')}
      subtitle={t('fil.subtitle')}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <StubBanner text={t('fil.stub')} />
      {feedLabel ? <Text style={styles.meta}>{feedLabel}</Text> : null}

      <Card title={t('fil.aiTitle')}>
        <Text style={styles.aiHint}>{t('fil.aiGlobalHint')}</Text>
      </Card>

      <Pressable style={styles.refreshBar} onPress={onRefresh}>
        <Text style={styles.refreshTxt}>
          {refreshing ? 'Actualisation…' : '↓ Actualiser le fil (pull ou tap)'}
        </Text>
      </Pressable>

      <Card title={t('fil.publish')}>
        <Text style={styles.meta}>
          Conducteurs et garagistes : partagez pannes et conseils. Vidéo → Firebase Storage CDN si
          Auth + rules ; sinon soft-fail on-device. {VIDEO_CDN_READY}
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
          <Text style={styles.meta}>Vidéo locale prête — upload CDN tenté à la publication.</Text>
        ) : null}
        <Pressable
          style={[styles.send, uploadingCdn && { opacity: 0.6 }]}
          disabled={uploadingCdn}
          onPress={() => void publishCaption()}
        >
          <Text style={styles.uploadTxt}>
            {uploadingCdn
              ? 'Upload CDN…'
              : localVideoUri
                ? 'Publier + tenter CDN'
                : 'Publier le texte'}
          </Text>
        </Pressable>
        <Pressable style={styles.upload} onPress={() => void tryPickVideo()}>
          <Text style={styles.uploadTxt}>Choisir une vidéo locale</Text>
        </Pressable>
        {uploadMsg ? <Text style={styles.warn}>{uploadMsg}</Text> : null}
      </Card>

      {posts.length === 0 ? (
        <Card title={t('fil.empty')}>
          <Text style={styles.meta}>
            Aucune publication pour l’instant — écrivez un conseil ci-dessus ou tirez pour
            rafraîchir. Soft-fail Firebase n’injecte plus de posts mock.
          </Text>
        </Card>
      ) : null}

      {posts.map((p) => {
        const isCdn = p.mediaKind === 'video_cdn' || Boolean(p.remoteMediaUrl);
        const isLocalVideo =
          !isCdn &&
          (p.mediaKind === 'video_local' ||
            Boolean(p.localMediaUri) ||
            p.caption.toLowerCase().includes('[vidéo'));
        return (
          <Card key={p.id} title={p.title}>
            <Text style={styles.meta}>
              {p.author} · {new Date(p.createdAt).toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.caption}>{p.caption}</Text>
            {isCdn ? (
              <View style={styles.videoStub}>
                <Text style={styles.videoStubTxt}>
                  [vidéo CDN] {p.remoteMediaUrl ?? 'URL Storage'}
                </Text>
              </View>
            ) : isLocalVideo ? (
              <View style={styles.videoStub}>
                <Text style={styles.videoStubTxt}>
                  {p.localMediaUri
                    ? '[vidéo locale on-device — CDN soft-fail ou hors ligne]'
                    : '[réf. vidéo — pas d’URL CDN]'}
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
  aiHint: {
    color: colors.slate,
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
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
