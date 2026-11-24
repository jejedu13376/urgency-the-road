/**
 * Lazy expo-speech bridge so Node unit tests can import urgence modules
 * without loading the Expo runtime (__DEV__).
 * Honors app-wide mute + dyslexia-friendly default rate when available.
 */

type SpeakOpts = {
  language?: string;
  volume?: number;
  rate?: number;
  pitch?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: () => void;
};

type SpeechApi = {
  speak: (text: string, options?: SpeakOpts) => void;
  stop: () => Promise<void> | void;
};

let cached: SpeechApi | null = null;

async function loadSpeech(): Promise<SpeechApi | null> {
  if (cached) return cached;
  try {
    const mod = (await import('expo-speech')) as SpeechApi;
    cached = mod;
    return mod;
  } catch {
    return null;
  }
}

async function isMuted(): Promise<boolean> {
  try {
    const { isAppSpeechMutedSync, loadAppSpeechMuted } = await import('../speech/appSpeech');
    await loadAppSpeechMuted();
    return isAppSpeechMutedSync();
  } catch {
    return false;
  }
}

export async function speechStop(): Promise<void> {
  const s = await loadSpeech();
  try {
    await s?.stop();
  } catch {
    /* ignore */
  }
}

export function speakViaExpo(
  language: string,
  text: string,
  opts?: Omit<SpeakOpts, 'language' | 'onDone' | 'onStopped' | 'onError'> & {
    force?: boolean;
  },
): Promise<void> {
  return new Promise((resolve) => {
    void (async () => {
      if (!opts?.force && (await isMuted())) {
        resolve();
        return;
      }
      const s = await loadSpeech();
      if (!s) {
        resolve();
        return;
      }
      let rate = opts?.rate;
      if (rate == null) {
        try {
          const { DYSLEXIA_SPEECH_RATE } = await import('../speech/appSpeech');
          rate = DYSLEXIA_SPEECH_RATE;
        } catch {
          rate = 0.85;
        }
      }
      s.speak(text, {
        language,
        volume: opts?.volume ?? 1.0,
        rate,
        pitch: opts?.pitch ?? 1.0,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    })();
  });
}
