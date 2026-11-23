export type ServiceResult<T> = {
  data: T;
  source: 'firebase' | 'mock';
  stubLabel?: string;
};

export function mockResult<T>(data: T, stubLabel: string): ServiceResult<T> {
  return { data, source: 'mock', stubLabel };
}

export function liveResult<T>(data: T): ServiceResult<T> {
  return { data, source: 'firebase' };
}
