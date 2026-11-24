/**
 * Address-only autocomplete for Carte / GPS destination + étapes.
 * Prefers Google Places when EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is set;
 * otherwise (or on Places failure) uses Open-Meteo → Photon geocode.
 * Not for product / route / catalog suggestions.
 */

import {
  fetchPlacesAutocomplete,
  isGooglePlacesConfigured,
  type PlacesSuggestion,
} from './googlePlacesAutocomplete';
import { geocodePlace, type GeocodeHit } from './openMeteoGeocode';

export type AddressSuggestion = {
  /** Stable list key (placeId or geo coords + label). */
  id: string;
  mainText: string;
  secondaryText: string;
  label: string;
  /** Google Places id — resolve via Place Details. */
  placeId?: string;
  /** Present when suggestion already has coords (geocode path). */
  lat?: number;
  lon?: number;
  source: 'google_places' | 'open-meteo' | 'photon' | 'none';
};

export type AddressSuggestResult = {
  ok: boolean;
  suggestions: AddressSuggestion[];
  error?: string;
  source: AddressSuggestion['source'];
};

function fromPlaces(s: PlacesSuggestion): AddressSuggestion {
  return {
    id: s.placeId,
    placeId: s.placeId,
    mainText: s.mainText || s.label,
    secondaryText: s.secondaryText,
    label: s.label,
    source: 'google_places',
  };
}

function fromGeocode(hit: GeocodeHit, source: 'open-meteo' | 'photon'): AddressSuggestion {
  const secondary = [hit.admin1, hit.country].filter(Boolean).join(', ');
  return {
    id: `geo:${hit.lat.toFixed(5)},${hit.lon.toFixed(5)}:${hit.label}`,
    mainText: hit.name,
    secondaryText: secondary,
    label: hit.label,
    lat: hit.lat,
    lon: hit.lon,
    source,
  };
}

/**
 * Live address suggestions while the user types (min 2 chars).
 * Pass the same Places `sessionToken` when the key is configured.
 */
export async function fetchAddressSuggestions(
  input: string,
  sessionToken: string,
  opts?: { limit?: number; languageCode?: string },
): Promise<AddressSuggestResult> {
  const q = input.trim();
  const limit = Math.min(Math.max(opts?.limit ?? 6, 1), 8);
  if (q.length < 2) {
    return { ok: true, suggestions: [], source: 'none' };
  }

  if (isGooglePlacesConfigured()) {
    const places = await fetchPlacesAutocomplete(q, sessionToken, {
      limit,
      languageCode: opts?.languageCode,
    });
    if (places.suggestions.length > 0) {
      return {
        ok: true,
        suggestions: places.suggestions.map(fromPlaces),
        source: 'google_places',
      };
    }
    // Soft fall through to free geocode when Places empty or errored.
  }

  const geo = await geocodePlace(q, limit);
  if (geo.ok && geo.hits.length > 0) {
    const source = geo.source === 'photon' ? 'photon' : 'open-meteo';
    return {
      ok: true,
      suggestions: geo.hits.map((h) => fromGeocode(h, source)),
      source,
    };
  }

  return {
    ok: false,
    suggestions: [],
    error:
      geo.error ??
      (isGooglePlacesConfigured()
        ? 'Aucune adresse trouvée'
        : 'Aucune adresse (géocode) — ajoutez EXPO_PUBLIC_GOOGLE_PLACES_API_KEY pour Places'),
    source: geo.source === 'photon' || geo.source === 'open-meteo' ? geo.source : 'none',
  };
}

export { isGooglePlacesConfigured };
