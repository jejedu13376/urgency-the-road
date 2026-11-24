/**
 * App-wide TTS (expo-speech): shared mute, FR/EN/ES locale, dyslexia-friendly rate.
 * GPS map mute toggle uses the same mute flag so one control silences all voice.
 * Speech module is lazy-loaded so Node unit tests can import mute/locale helpers.
 */
import { i18n, type AppLocale, isAppLocale } from '../../i18n';
import {
  DYSLEXIA_SPEECH_PITCH,
  DYSLEXIA_SPEECH_RATE,
  speechLanguageForLocale,
} from './speechLocale';

export { DYSLEXIA_SPEECH_PITCH, DYSLEXIA_SPEECH_RATE, speechLanguageForLocale };

/** Same key as historical GPS nav mute — one switch for the whole app. */
export const APP_SPEECH_MUTE_KEY = 'um.gps.nav.speech.muted.v1';

type SpeakOpts = {
  language?: string;
  volume?: number;
  rate?: number;
  pitch?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
};

type SpeechApi = {
  speak: (text: string, options?: SpeakOpts) => void;
  stop: () => Promise<void> | void;
};

type StorageApi = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let cachedSpeech: SpeechApi | null = null;
let cachedStorage: StorageApi | null = null;
let mutedMemory = false;
let muteLoaded = false;

async function loadSpeech(): Promise<SpeechApi | null> {
  if (cachedSpeech) return cachedSpeech;
  try {
    const mod = (await import('expo-speech')) as SpeechApi;
    cachedSpeech = mod;
    return mod;
  } catch {
    return null;
  }
}

async function loadStorage(): Promise<StorageApi | null> {
  if (cachedStorage) return cachedStorage;
  try {
    const mod = (await import('@react-native-async-storage/async-storage')) as {
      default: StorageApi;
    };
    cachedStorage = mod.default;
    return cachedStorage;
  } catch {
    return null;
  }
}

function currentLocale(): AppLocale {
  const raw = String(i18n.locale ?? 'fr').slice(0, 2).toLowerCase();
  return isAppLocale(raw) ? raw : 'fr';
}

function languageTag(locale?: AppLocale): string {
  return speechLanguageForLocale(locale ?? currentLocale());
}

export async function loadAppSpeechMuted(): Promise<boolean> {
  if (muteLoaded) return mutedMemory;
  try {
    const storage = await loadStorage();
    const raw = storage ? await storage.getItem(APP_SPEECH_MUTE_KEY) : null;
    mutedMemory = raw === '1';
  } catch {
    mutedMemory = false;
  }
  muteLoaded = true;
  return mutedMemory;
}

export async function setAppSpeechMuted(muted: boolean): Promise<void> {
  mutedMemory = muted;
  muteLoaded = true;
  try {
    const storage = await loadStorage();
    await storage?.setItem(APP_SPEECH_MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (muted) stopAppSpeech();
}

export function isAppSpeechMutedSync(): boolean {
  return mutedMemory;
}

export function stopAppSpeech(): void {
  void loadSpeech().then((s) => {
    try {
      void s?.stop();
    } catch {
      /* soft-fail */
    }
  });
}

export type SpeakAppOptions = {
  /** Bypass mute (e.g. explicit user tap on Speak). Default false. */
  force?: boolean;
  language?: string;
  locale?: AppLocale;
  rate?: number;
  pitch?: number;
  volume?: number;
  /** Max characters spoken (dyslexia: keep utterances short). Default 480. */
  maxLen?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Speak text in the active (or given) language. No-ops when muted unless `force`.
 */
export function speakApp(text: string, opts?: SpeakAppOptions): void {
  const phrase = text.replace(/\s+/g, ' ').trim();
  if (!phrase) return;
  if (!opts?.force && mutedMemory) return;
  const maxLen = opts?.maxLen ?? 480;
  const clipped = phrase.slice(0, maxLen);
  const language = opts?.language ?? languageTag(opts?.locale);
  void loadSpeech().then((s) => {
    if (!s) {
      opts?.onError?.(new Error('speech_unavailable'));
      return;
    }
    try {
      void s.stop();
      s.speak(clipped, {
        language,
        rate: opts?.rate ?? DYSLEXIA_SPEECH_RATE,
        pitch: opts?.pitch ?? DYSLEXIA_SPEECH_PITCH,
        volume: opts?.volume ?? 1.0,
        onDone: opts?.onDone,
        onStopped: opts?.onStopped,
        onError: opts?.onError,
      });
    } catch {
      opts?.onError?.(new Error('speech_unavailable'));
    }
  });
}

/** Promise form for sequential alerts (safety modules). Honors mute unless force. */
export function speakAppAsync(
  text: string,
  opts?: SpeakAppOptions,
): Promise<void> {
  return new Promise((resolve) => {
    const phrase = text.replace(/\s+/g, ' ').trim();
    if (!phrase) {
      resolve();
      return;
    }
    if (!opts?.force && mutedMemory) {
      resolve();
      return;
    }
    const maxLen = opts?.maxLen ?? 480;
    const clipped = phrase.slice(0, maxLen);
    const language = opts?.language ?? languageTag(opts?.locale);
    void loadSpeech().then((s) => {
      if (!s) {
        resolve();
        return;
      }
      try {
        s.speak(clipped, {
          language,
          rate: opts?.rate ?? DYSLEXIA_SPEECH_RATE,
          pitch: opts?.pitch ?? DYSLEXIA_SPEECH_PITCH,
          volume: opts?.volume ?? 1.0,
          onDone: () => {
            opts?.onDone?.();
            resolve();
          },
          onStopped: () => {
            opts?.onStopped?.();
            resolve();
          },
          onError: (error) => {
            opts?.onError?.(error);
            resolve();
          },
        });
      } catch {
        resolve();
      }
    });
  });
}
