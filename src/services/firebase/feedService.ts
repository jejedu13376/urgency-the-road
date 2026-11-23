/**
 * Module 12 — feed posts via Firestore when configured; mock fallback.
 */
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type { FeedPost } from '../../types/modules';
import { COLLECTIONS } from '../../types/firestore';
import { MOCK_FEED } from '../../data/mocks';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

function mapDoc(id: string, data: Record<string, unknown>): FeedPost {
  return {
    id,
    author: String(data.author ?? data.authorName ?? 'Anonyme'),
    title: String(data.title ?? ''),
    caption: String(data.caption ?? data.body ?? ''),
    likes: Number(data.likes ?? 0),
    comments: Number(data.comments ?? 0),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
  };
}

export async function listFeedPosts(max = 40): Promise<ServiceResult<FeedPost[]>> {
  const fb = getFirebase();
  if (!fb) return mockResult(MOCK_FEED, 'MOCK fil — Firebase off');

  try {
    const q = query(
      collection(fb.db, COLLECTIONS.feedPosts),
      orderBy('createdAt', 'desc'),
      limit(Math.min(Math.max(max, 1), 80)),
    );
    const snap = await getDocs(q);
    if (snap.empty) return mockResult(MOCK_FEED, 'MOCK fil — Firestore vide');
    const posts = snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
    return liveResult(posts);
  } catch (e) {
    return failResult(
      MOCK_FEED,
      e instanceof Error ? e.message : 'Lecture fil refusée',
    );
  }
}

export async function createTextFeedPost(input: {
  title: string;
  caption: string;
  authorName?: string;
}): Promise<ServiceResult<FeedPost | null>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  const title = input.title.trim() || 'Publication';
  const caption = input.caption.trim();
  // Defense in depth: never persist email-like author on world-readable feedPosts
  const rawAuthor = input.authorName?.trim() || '';
  const looksLikeEmail = /@/.test(rawAuthor);
  const author =
    !rawAuthor || looksLikeEmail
      ? uid
        ? `Conducteur-${uid.slice(0, 6)}`
        : 'Conducteur'
      : rawAuthor;

  if (!fb || !uid) {
    const local: FeedPost = {
      id: `local-${Date.now()}`,
      author,
      title,
      caption: caption || 'Note locale (non sync)',
      likes: 0,
      comments: 0,
      createdAt: new Date().toISOString(),
    };
    return mockResult(local, 'MOCK publish — connectez-vous pour sync Firestore');
  }

  if (!caption) {
    return failResult(null, 'Légende requise');
  }

  try {
    const ref = await addDoc(collection(fb.db, COLLECTIONS.feedPosts), {
      authorUid: uid,
      author,
      title,
      caption,
      likes: 0,
      comments: 0,
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
    });
    return liveResult({
      id: ref.id,
      author,
      title,
      caption,
      likes: 0,
      comments: 0,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    return failResult(null, e instanceof Error ? e.message : 'Publication refusée');
  }
}
