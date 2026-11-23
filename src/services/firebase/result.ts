export type ServiceResult<T> = {
  data: T;
  /** firebase = Firestore; live = free external API (OSM/Open-Meteo/…); mock = local fallback */
  source: 'firebase' | 'live' | 'mock';
  stubLabel?: string;
  /** false when the live call failed (Auth error, rules deny, etc.) */
  ok?: boolean;
};

export function mockResult<T>(data: T, stubLabel: string): ServiceResult<T> {
  return { data, source: 'mock', stubLabel, ok: true };
}

export function liveResult<T>(data: T, stubLabel?: string): ServiceResult<T> {
  return { data, source: 'firebase', stubLabel, ok: true };
}

/** Free public API path (Overpass, Open-Meteo, …) — not Firestore. */
export function externalLiveResult<T>(data: T, stubLabel?: string): ServiceResult<T> {
  return { data, source: 'live', stubLabel, ok: true };
}

export function failResult<T>(data: T, message: string): ServiceResult<T> {
  return { data, source: 'firebase', stubLabel: message, ok: false };
}

/**
 * Demo / soft PHI payload — never looks live.
 * `ok: false` so screens that gate on `ok` do not hydrate as real data;
 * `source: 'mock'` + stubLabel must say DEMO / soft.
 */
export function flaggedDemoResult<T>(data: T, stubLabel: string): ServiceResult<T> {
  return { data, source: 'mock', stubLabel, ok: false };
}
