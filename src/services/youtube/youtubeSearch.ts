/**
 * YouTube Data API v3 — search.list utility.
 * Key from EXPO_PUBLIC_YOUTUBE_API_KEY only (never hardcode).
 * Opens watch URLs only — no embedded video files.
 * In-memory TTL cache + slim fields + AbortController timeout.
 */

export type YoutubeVideoHit = {
  videoId: string;
  title: string;
  channelTitle: string;
  watchUrl: string;
  thumbnailUrl?: string;
};

export type YoutubeSearchResult = {
  ok: boolean;
  httpStatus: number;
  items: YoutubeVideoHit[];
  error?: string;
  source: 'youtube_api' | 'fallback_search_url' | 'cache';
  cached?: boolean;
};

function getApiKey(): string {
  return (process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ?? '').trim();
}

export function isYoutubeApiConfigured(): boolean {
  return getApiKey().length > 0;
}

export function watchUrlFor(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export function youtubeSearchUrl(keyword: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword.trim() || 'réparation automobile')}`;
}

type CacheEntry = { at: number; result: YoutubeSearchResult };
const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

/**
 * Search top relevant videos for a mechanic problem keyword.
 * @example searchYoutubeVideos('remplacement plaquettes de frein')
 */
export async function searchYoutubeVideos(
  keyword: string,
  maxResults = 5,
): Promise<YoutubeSearchResult> {
  const q = keyword.trim() || 'réparation automobile';
  const capped = Math.min(Math.max(maxResults, 1), 8);
  const cacheKey = `${q.toLowerCase()}|${capped}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ...cached.result, source: 'cache', cached: true };
  }

  const key = getApiKey();

  if (!key) {
    return {
      ok: false,
      httpStatus: 0,
      items: [],
      error: 'EXPO_PUBLIC_YOUTUBE_API_KEY manquant — fallback search URL only',
      source: 'fallback_search_url',
    };
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(capped));
  url.searchParams.set('q', q);
  url.searchParams.set('key', key);
  url.searchParams.set('relevanceLanguage', 'fr');
  url.searchParams.set('safeSearch', 'moderate');
  // Slim payload — only fields we map (lower latency / parse cost)
  url.searchParams.set(
    'fields',
    'items(id/videoId,snippet(title,channelTitle,thumbnails/default/url))',
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    const httpStatus = res.status;
    const body = (await res.json()) as {
      error?: { message?: string; errors?: { reason?: string }[] };
      items?: {
        id?: { videoId?: string };
        snippet?: { title?: string; channelTitle?: string; thumbnails?: { default?: { url?: string } } };
      }[];
    };

    if (!res.ok) {
      return {
        ok: false,
        httpStatus,
        items: [],
        error: body.error?.message ?? `YouTube search.list HTTP ${httpStatus}`,
        source: 'youtube_api',
      };
    }

    const items: YoutubeVideoHit[] = [];
    for (const it of body.items ?? []) {
      const videoId = it.id?.videoId;
      if (!videoId) continue;
      items.push({
        videoId,
        title: it.snippet?.title ?? videoId,
        channelTitle: it.snippet?.channelTitle ?? '',
        watchUrl: watchUrlFor(videoId),
        thumbnailUrl: it.snippet?.thumbnails?.default?.url,
      });
    }

    const result: YoutubeSearchResult = { ok: true, httpStatus, items, source: 'youtube_api' };
    searchCache.set(cacheKey, { at: Date.now(), result });
    return result;
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return {
      ok: false,
      httpStatus: 0,
      items: [],
      error: aborted ? `YouTube timeout ${FETCH_TIMEOUT_MS}ms` : e instanceof Error ? e.message : String(e),
      source: 'youtube_api',
    };
  } finally {
    clearTimeout(timer);
  }
}
