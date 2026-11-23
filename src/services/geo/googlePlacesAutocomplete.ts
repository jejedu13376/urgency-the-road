/**
 * Google Places Autocomplete (New) + Place Details (New) for Module 7 GPS search.
 * Key from EXPO_PUBLIC_GOOGLE_PLACES_API_KEY only (never hardcode).
 * Session tokens group typing + place pick for billing (UUID per session).
 */

export type PlacesSuggestion = {
  placeId: string;
  /** Primary line (street / place name). */
  mainText: string;
  /** Secondary line (city / region). */
  secondaryText: string;
  /** Full display label for the search field. */
  label: string;
};

export type PlacesAutocompleteResult = {
  ok: boolean;
  suggestions: PlacesSuggestion[];
  error?: string;
  source: 'google_places' | 'none';
};

export type PlaceCoordsResult = {
  ok: boolean;
  lat?: number;
  lon?: number;
  label?: string;
  error?: string;
  source: 'google_places' | 'none';
};

const FETCH_TIMEOUT_MS = 7000;
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';

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

type AutocompleteBody = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
  error?: { message?: string; status?: string };
};

type PlaceDetailsBody = {
  id?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  error?: { message?: string };
};

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

/**
 * Live address suggestions while the user types.
 * Pass the same `sessionToken` into `resolvePlaceCoords` after a pick.
 */
export async function fetchPlacesAutocomplete(
  input: string,
  sessionToken: string,
  opts?: { limit?: number; languageCode?: string },
): Promise<PlacesAutocompleteResult> {
  const q = input.trim();
  if (q.length < 2) {
    return { ok: true, suggestions: [], source: 'google_places' };
  }

  const key = getApiKey();
  if (!key) {
    return {
      ok: false,
      suggestions: [],
      error: 'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY manquant',
      source: 'none',
    };
  }

  const limit = Math.min(Math.max(opts?.limit ?? 6, 1), 8);
  const languageCode = opts?.languageCode ?? 'fr';

  try {
    const res = await fetchWithTimeout(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify({
        input: q,
        sessionToken,
        languageCode,
      }),
    });

    const body = (await res.json()) as AutocompleteBody;
    if (!res.ok) {
      return {
        ok: false,
        suggestions: [],
        error: body.error?.message ?? `Places Autocomplete HTTP ${res.status}`,
        source: 'google_places',
      };
    }

    const suggestions: PlacesSuggestion[] = [];
    for (const s of body.suggestions ?? []) {
      const p = s.placePrediction;
      if (!p?.placeId) continue;
      const mainText = p.structuredFormat?.mainText?.text ?? p.text?.text ?? '';
      const secondaryText = p.structuredFormat?.secondaryText?.text ?? '';
      const label = p.text?.text ?? [mainText, secondaryText].filter(Boolean).join(', ');
      if (!label) continue;
      suggestions.push({ placeId: p.placeId, mainText, secondaryText, label });
      if (suggestions.length >= limit) break;
    }

    return {
      ok: suggestions.length > 0,
      suggestions,
      error: suggestions.length ? undefined : 'Aucun résultat Places',
      source: 'google_places',
    };
  } catch (e) {
    return {
      ok: false,
      suggestions: [],
      error: e instanceof Error ? e.message : 'Places Autocomplete réseau KO',
      source: 'google_places',
    };
  }
}

/**
 * Resolve lat/lon for a selected suggestion. Ends the billing session.
 */
export async function resolvePlaceCoords(
  placeId: string,
  sessionToken: string,
  opts?: { languageCode?: string },
): Promise<PlaceCoordsResult> {
  const id = placeId.trim();
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

  const languageCode = opts?.languageCode ?? 'fr';
  const bareId = id.startsWith('places/') ? id.slice('places/'.length) : id;
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(bareId)}`);
  url.searchParams.set('sessionToken', sessionToken);
  url.searchParams.set('languageCode', languageCode);

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'id,formattedAddress,displayName,location',
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
    if (typeof lat !== 'number' || typeof lon !== 'number') {
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

    return { ok: true, lat, lon, label, source: 'google_places' };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Place Details réseau KO',
      source: 'google_places',
    };
  }
}
