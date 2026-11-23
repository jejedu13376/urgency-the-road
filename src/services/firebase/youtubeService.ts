import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getFirebase } from '../../firebase/config';
import type { YoutubeSuggestionDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

/** Module 6 / 11 — YouTube URL stubs only (no embedded video). */
export async function suggestYoutube(
  problemQuery: string,
  make?: string,
  model?: string,
): Promise<ServiceResult<YoutubeSuggestionDoc[]>> {
  const q = problemQuery.trim() || 'réparation freins';
  const stubs: YoutubeSuggestionDoc[] = [
    {
      id: 'yt1',
      query: q,
      make,
      model,
      title: `${make ?? ''} ${model ?? ''} — ${q} (tutoriel)`.trim(),
      youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        [make, model, q].filter(Boolean).join(' '),
      )}`,
      channel: 'Suggestion stub',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'yt2',
      query: q,
      make,
      model,
      title: `Schéma montage ${q}`,
      youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${q} schéma montage automobile`,
      )}`,
      createdAt: new Date().toISOString(),
    },
  ];

  const fb = getFirebase();
  if (!fb) return mockResult(stubs, 'MOCK YouTube suggestions — redirection URL only');

  const snap = await getDocs(
    query(collection(fb.db, COLLECTIONS.youtubeSuggestions), where('query', '==', q), limit(10)),
  );
  if (snap.empty) return mockResult(stubs, 'MOCK YouTube — collection vide, stubs URL');
  return liveResult(
    snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<YoutubeSuggestionDoc, 'id'>) })),
  );
}
