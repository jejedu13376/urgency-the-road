export type ServiceResult<T> = {
  data: T;
  source: 'firebase' | 'mock';
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

export function failResult<T>(data: T, message: string): ServiceResult<T> {
  return { data, source: 'firebase', stubLabel: message, ok: false };
}
