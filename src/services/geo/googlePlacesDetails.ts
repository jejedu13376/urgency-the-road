/**
 * Shared Google Places Details (New) helper for Module 7 GPS.
 * Used by autocomplete (coords) and POI reviews (rating + avis).
 * Key: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY only (never hardcode).
 *
 * Field masks (X-Goog-FieldMask) — document & keep tight for billing:
 * - Coords / label: id,formattedAddress,displayName,location
 * - Reviews panel:  id,displayName,formattedAddress,location,rating,userRatingCount,reviews
 *   (rating + userRatingCount → Place Details Enterprise SKU;
 *    reviews → Enterprise + Atmosphere SKU)
 */

const FETCH_TIMEOUT_MS = 7000;
const PLACES_BASE = 'https://places.googleapis.com/v1/places';

/** Essentials-ish mask for lat/lon resolve after autocomplete pick. */
export const PLACE_COORDS_FIELD_MASK =
  'id,formattedAddress,displayName,location' as const;

/**
 * Full mask for destination POI card: coords + stars + short avis list.
 * Prefer one Details call with this mask after place select (ends session token).
 */
export const PLACE_REVIEWS_FIELD_MASK =
  'id,displayName,formattedAddress,location,rating,userRatingCount,reviews' as const;

export type PlaceReview = {
  rating?: number;
  text: string;
  relativeTime?: string;
  author?: string;
};

export type PlaceDetailsData = {
  placeId: string;
  lat: number;
  lon: number;
  label: string;
  displayName?: string;
  rating?: number;
  userRatingCount?: number;
  reviews: PlaceReview[];
};

export type PlaceDetailsResult = {
  ok: boolean;
  data?: PlaceDetailsData;
  error?: string;
  source: 'google_places' | 'none';
};

type PlaceDetailsBody = {
  id?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  reviews?: {
    rating?: number;
    relativePublishTimeDescription?: string;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: { displayName?: string };
  }[];
  error?: { message?: string };
};

function getApiKey(): string {
  return (process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '').trim();
}

export function isGooglePlacesConfigured(): boolean {
  return getApiKey().length > 0;
}

/** Fresh session token (UUID v4) — one per autocomplete → details flow. */
export function newPlacesSessionToken(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function barePlaceId(placeId: string): string {
  const id = placeId.trim();
  return id.startsWith('places/') ? id.slice('places/'.length) : id;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function parseReviews(body: PlaceDetailsBody): PlaceReview[] {
  const out: PlaceReview[] = [];
  for (const r of body.reviews ?? []) {
    const text = (r.text?.text ?? r.originalText?.text ?? '').trim();
    if (!text) continue;
    out.push({
      rating: typeof r.rating === 'number' ? r.rating : undefined,
      text,
      relativeTime: r.relativePublishTimeDescription?.trim() || undefined,
      author: r.authorAttribution?.displayName?.trim() || undefined,
    });
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Place Details (New) with an explicit field mask.
 * Pass the autocomplete `sessionToken` on the first Details call after a pick to end billing session.
 */
export async function fetchPlaceDetails(
  placeId: string,
  opts: {
    fieldMask: string;
    sessionToken?: string;
    languageCode?: string;
  },
): Promise<PlaceDetailsResult> {
  const id = barePlaceId(placeId);
  if (!id) {
    return { ok: false, error: 'placeId vide', source: 'none' };
  }

  const key = getApiKey();
  if (!key) {
    return {
      ok: false,
      error: 'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY manquant',
      source: 'none',
    };
  }

  const languageCode = opts.languageCode ?? 'fr';
  const url = new URL(`${PLACES_BASE}/${encodeURIComponent(id)}`);
  if (opts.sessionToken) url.searchParams.set('sessionToken', opts.sessionToken);
  url.searchParams.set('languageCode', languageCode);

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': opts.fieldMask,
      },
    });

    const body = (await res.json()) as PlaceDetailsBody;
    if (!res.ok) {
      return {
        ok: false,
        error: body.error?.message ?? `Place Details HTTP ${res.status}`,
        source: 'google_places',
      };
    }

    const lat = body.location?.latitude;
    const lon = body.location?.longitude;
    const needsCoords = opts.fieldMask.includes('location');
    if (needsCoords && (typeof lat !== 'number' || typeof lon !== 'number')) {
      return {
        ok: false,
        error: 'Place Details — coordonnées manquantes',
        source: 'google_places',
      };
    }

    const label =
      body.formattedAddress?.trim() ||
      body.displayName?.text?.trim() ||
      id;

    return {
      ok: true,
      data: {
        placeId: body.id ?? id,
        lat: typeof lat === 'number' ? lat : Number.NaN,
        lon: typeof lon === 'number' ? lon : Number.NaN,
        label,
        displayName: body.displayName?.text?.trim() || undefined,
        rating: typeof body.rating === 'number' ? body.rating : undefined,
        userRatingCount:
          typeof body.userRatingCount === 'number' ? body.userRatingCount : undefined,
        reviews: parseReviews(body),
      },
      source: 'google_places',
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Place Details réseau KO',
      source: 'google_places',
    };
  }
}

/**
 * After place select: one Details call for route coords + rating + avis.
 * Ends the autocomplete billing session when `sessionToken` is provided.
 */
export async function fetchPlaceDetailsWithReviews(
  placeId: string,
  sessionToken?: string,
  opts?: { languageCode?: string },
): Promise<PlaceDetailsResult> {
  return fetchPlaceDetails(placeId, {
    fieldMask: PLACE_REVIEWS_FIELD_MASK,
    sessionToken,
    languageCode: opts?.languageCode,
  });
}
