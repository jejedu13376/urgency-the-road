/**
 * Module 13 — mandatory 2h driving break reminder.
 * Accumulates GPS motion time only (not wall-clock while the app is merely open).
 * TTS speaks FR then EN at max volume; resets after the driver takes a break.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { speakViaExpo, speechStop } from './speechBridge';

export const DRIVING_BREAK_STORAGE_KEY = 'um.urgence.drivingBreak.v1';

/** Mandatory comfort break after this much accumulated driving time. */
export const DRIVING_BREAK_THRESHOLD_SEC = 2 * 60 * 60;

/**
 * Minimum ground speed (m/s) to count as driving (~7.2 km/h).
 * Stationary / app-open-only time must not accumulate.
 */
export const DRIVING_SPEED_MIN_MPS = 2;

export const BREAK_TTS_FR =
  'Il est temps de faire une pause. Allez boire un café et dégourdir les jambes.';

export const BREAK_TTS_EN =
  'Time for a break. Go grab a coffee and stretch your legs.';

export const BREAK_TTS_ES =
  'Es hora de hacer una pausa. Ve a tomar un café y estira las piernas.';

/** Exact order: FR → EN → ES. */
export const BREAK_TTS_SEQUENCE: readonly { language: string; text: string }[] = [
  { language: 'fr-FR', text: BREAK_TTS_FR },
  { language: 'en-US', text: BREAK_TTS_EN },
  { language: 'es-ES', text: BREAK_TTS_ES },
];

export type DrivingBreakState = {
  /** Accumulated seconds while GPS speed indicated motion. */
  drivingSec: number;
  /** True after the 2h TTS has been spoken until the driver resets/takes a break. */
  alertSpoken: boolean;
  updatedAt: string;
};

export function createInitialDrivingBreakState(): DrivingBreakState {
  return {
    drivingSec: 0,
    alertSpoken: false,
    updatedAt: new Date().toISOString(),
  };
}

export function shouldCountAsDriving(speedMps: number | null | undefined): boolean {
  return typeof speedMps === 'number' && Number.isFinite(speedMps) && speedMps >= DRIVING_SPEED_MIN_MPS;
}

/**
 * Pure accumulator: only motion deltas add time. Returns whether a new 2h crossing occurred.
 */
export function accumulateDrivingTime(
  state: DrivingBreakState,
  opts: { deltaSec: number; speedMps: number | null | undefined; nowIso?: string },
): { state: DrivingBreakState; crossedThreshold: boolean } {
  const delta = Math.max(0, opts.deltaSec);
  if (!shouldCountAsDriving(opts.speedMps) || delta <= 0) {
    return {
      state: { ...state, updatedAt: opts.nowIso ?? new Date().toISOString() },
      crossedThreshold: false,
    };
  }
  const prev = state.drivingSec;
  const next = prev + delta;
  const crossedThreshold =
    prev < DRIVING_BREAK_THRESHOLD_SEC && next >= DRIVING_BREAK_THRESHOLD_SEC;
  return {
    state: {
      drivingSec: next,
      alertSpoken: state.alertSpoken,
      updatedAt: opts.nowIso ?? new Date().toISOString(),
    },
    crossedThreshold,
  };
}

/** Reset after the driver takes a break (manual pause / confirm). */
export function resetDrivingBreakAfterBreak(): DrivingBreakState {
  return createInitialDrivingBreakState();
}

export function isDrivingBreakDue(state: DrivingBreakState): boolean {
  return state.drivingSec >= DRIVING_BREAK_THRESHOLD_SEC;
}

export async function loadDrivingBreakState(): Promise<DrivingBreakState> {
  try {
    const raw = await AsyncStorage.getItem(DRIVING_BREAK_STORAGE_KEY);
    if (!raw) return createInitialDrivingBreakState();
    const parsed = JSON.parse(raw) as Partial<DrivingBreakState>;
    return {
      drivingSec: typeof parsed.drivingSec === 'number' && parsed.drivingSec >= 0 ? parsed.drivingSec : 0,
      alertSpoken: parsed.alertSpoken === true,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return createInitialDrivingBreakState();
  }
}

export async function saveDrivingBreakState(state: DrivingBreakState): Promise<void> {
  await AsyncStorage.setItem(DRIVING_BREAK_STORAGE_KEY, JSON.stringify(state));
}

function speakOne(language: string, text: string): Promise<void> {
  return speakViaExpo(language, text, { volume: 1.0, rate: 0.95, pitch: 1.0 });
}

/**
 * Loud TTS: French → English → Spanish.
 * Repeats the trio once so it is hard to miss.
 */
export async function speakDrivingBreakAlert(opts?: {
  speak?: (language: string, text: string) => Promise<void>;
  repeat?: number;
}): Promise<void> {
  const speak = opts?.speak ?? speakOne;
  const repeat = Math.max(1, opts?.repeat ?? 2);
  await speechStop();
  for (let i = 0; i < repeat; i += 1) {
    for (const line of BREAK_TTS_SEQUENCE) {
      await speak(line.language, line.text);
    }
  }
}

export async function markDrivingBreakAlertSpoken(
  state: DrivingBreakState,
): Promise<DrivingBreakState> {
  const next = {
    ...state,
    alertSpoken: true,
    updatedAt: new Date().toISOString(),
  };
  await saveDrivingBreakState(next);
  return next;
}
