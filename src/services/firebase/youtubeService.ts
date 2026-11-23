/**
 * Modules 6 / 11 — YouTube suggestions.
 * Uses EXPO_PUBLIC_YOUTUBE_API_KEY via youtubeSearch (env refs only — never hardcode).
 * Opens watch URLs only — no embedded video files.
 */
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getFirebase } from '../../firebase/config';
import type { YoutubeSuggestionDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import {
  isYoutubeApiConfigured,
  searchYoutubeVideos,
  watchUrlFor,
} from '../youtube/youtubeSearch';
import { liveResult, mockResult, ServiceResult } from './result';

function fallbackStubs(problemQuery: string, make?: string, model?: string): YoutubeSuggestionDoc[] {
  const q = problemQuery.trim() || 'réparation freins';
  const search = [make, model, q].filter(Boolean).join(' ');
  return [
    {
      id: 'yt-fallback-1',
      query: q,
      make,
      model,
      title: `${make ?? ''} ${model ?? ''} — ${q}`.trim(),
      youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(search)}`,
      channel: 'YouTube search (clé API absente)',
      createdAt: new Date().toISOString(),
    },
  ];
}

/** Prefer live Data API when EXPO_PUBLIC_YOUTUBE_API_KEY is set; else search URL fallback. */
export async function suggestYoutube(
  problemQuery: string,
  make?: string,
  model?: string,
): Promise<ServiceResult<YoutubeSuggestionDoc[]>> {
  const q = [make, model, problemQuery].filter(Boolean).join(' ').trim() || 'réparation automobile';

  if (isYoutubeApiConfigured()) {
    const live = await searchYoutubeVideos(q, 5);
    if (live.ok && live.items.length > 0) {
      const docs: YoutubeSuggestionDoc[] = live.items.map((item, i) => ({
        id: item.videoId || `yt-live-${i}`,
        query: problemQuery,
        make,
        model,
        title: item.title,
        youtubeUrl: item.watchUrl || watchUrlFor(item.videoId),
        channel: item.channelTitle,
        createdAt: new Date().toISOString(),
      }));
      return liveResult(docs);
    }
    return mockResult(
      fallbackStubs(problemQuery, make, model),
      live.error ?? 'YouTube API erreur — fallback search URL',
    );
  }

  const fb = getFirebase();
  if (fb) {
    try {
      const snap = await getDocs(
        query(
          collection(fb.db, COLLECTIONS.youtubeSuggestions),
          where('query', '==', problemQuery.trim() || 'réparation freins'),
          limit(10),
        ),
      );
      if (!snap.empty) {
        return liveResult(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<YoutubeSuggestionDoc, 'id'>) })),
        );
      }
    } catch {
      /* fall through to URL stubs */
    }
  }

  return mockResult(
    fallbackStubs(problemQuery, make, model),
    'YouTube — définir EXPO_PUBLIC_YOUTUBE_API_KEY (voir ENV-YOUTUBE.env) pour search.list live',
  );
}

export { isYoutubeApiConfigured } from '../youtube/youtubeSearch';
