import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  /** Present on the React Native / Metro Auth build. */
  export function getReactNativePersistence(storage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  }): Persistence;
}
