/**
 * Module 13 — drowsiness via on-device face / closed-eye samples.
 * Alert fires after exactly 3s of continuous closed eyes; loud audible (not visual-only).
 */
import { speakViaExpo, speechStop } from './speechBridge';

/** Exact closed-eyes duration before drowsiness alert (milliseconds). */
export const DROWSINESS_CLOSED_EYES_MS = 3000;

export const DROWSINESS_ALERT_FR =
  'Attention somnolence. Ouvrez les yeux. Faites une pause immédiatement.';

export const DROWSINESS_ALERT_EN =
  'Drowsiness alert. Open your eyes. Take a break right now.';

export type DrowsinessSample = {
  /** True when both eyes are closed (or eye-open probability below detector threshold). */
  eyesClosed: boolean;
  /** Monotonic timestamp in ms (e.g. performance.now / Date.now). */
  atMs: number;
};

export type DrowsinessMonitorState = {
  closedStreakMs: number;
  alerted: boolean;
  lastAtMs: number | null;
};

export function createDrowsinessMonitorState(): DrowsinessMonitorState {
  return { closedStreakMs: 0, alerted: false, lastAtMs: null };
}

/**
 * Feed consecutive face samples. Returns whether the 3s threshold was newly crossed.
 */
export function ingestDrowsinessSample(
  state: DrowsinessMonitorState,
  sample: DrowsinessSample,
): { state: DrowsinessMonitorState; crossedThreshold: boolean } {
  if (state.lastAtMs != null && sample.atMs < state.lastAtMs) {
    return { state, crossedThreshold: false };
  }

  if (!sample.eyesClosed) {
    return {
      state: { closedStreakMs: 0, alerted: false, lastAtMs: sample.atMs },
      crossedThreshold: false,
    };
  }

  const delta =
    state.lastAtMs == null ? 0 : Math.max(0, Math.min(500, sample.atMs - state.lastAtMs));
  const closedStreakMs = state.closedStreakMs + delta;
  const wasBelow = state.closedStreakMs < DROWSINESS_CLOSED_EYES_MS;
  const nowAtOrAbove = closedStreakMs >= DROWSINESS_CLOSED_EYES_MS;
  const crossedThreshold = wasBelow && nowAtOrAbove && !state.alerted;

  return {
    state: {
      closedStreakMs,
      alerted: state.alerted || crossedThreshold,
      lastAtMs: sample.atMs,
    },
    crossedThreshold,
  };
}

function speakOne(language: string, text: string): Promise<void> {
  return speakViaExpo(language, text, { volume: 1.0, rate: 1.0, pitch: 1.05 });
}

/** Loud ring-style TTS loop — hard to miss; not visual-only. */
export async function speakDrowsinessAlert(opts?: {
  speak?: (language: string, text: string) => Promise<void>;
  cycles?: number;
}): Promise<void> {
  const speak = opts?.speak ?? speakOne;
  const cycles = Math.max(1, opts?.cycles ?? 3);
  await speechStop();
  for (let i = 0; i < cycles; i += 1) {
    await speak('fr-FR', DROWSINESS_ALERT_FR);
    await speak('en-US', DROWSINESS_ALERT_EN);
  }
}

export function resetDrowsinessAlert(state: DrowsinessMonitorState): DrowsinessMonitorState {
  return { ...state, alerted: false, closedStreakMs: 0 };
}
