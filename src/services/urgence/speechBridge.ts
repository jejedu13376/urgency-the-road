/**
 * Lazy expo-speech bridge so Node unit tests can import urgence modules
 * without loading the Expo runtime (__DEV__).
 *
 * Safety alerts (break / drowsiness / fatigue / overspeed) intentionally
 * ignore the GPS nav mute flag — mute only gates speakApp / speakNav.
 * Dyslexia-friendly default rate when appSpeech is available.
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
  opts?: Omit<SpeakOpts, 'language' | 'onDone' | 'onStopped' | 'onError'>,
): Promise<void> {
  return new Promise((resolve) => {
    void (async () => {
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
