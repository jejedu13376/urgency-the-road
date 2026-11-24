/**
 * Module 13 — fatigue score from driving hours/breaks + regional HOS (CA/US/EU/AU).
 * Hard-to-ignore STOP alert when score hits critical or HOS is over limit.
 */
import { DRIVING_BREAK_THRESHOLD_SEC } from './drivingBreak';
import { speakViaExpo, speechStop } from './speechBridge';
import {
  evaluateHosCompliance,
  type HosCompliance,
  type HosRegionId,
} from './hosRegs';

/** 0 (fresh) → 100 (must stop). */
export type FatigueScore = {
  score: number;
  level: 'ok' | 'warn' | 'critical';
  drivingSec: number;
  breaksTaken: number;
  /** True when the driver must stop now. */
  mustStop: boolean;
  hos?: HosCompliance;
};

/** Critical threshold — hard STOP alert. */
export const FATIGUE_CRITICAL_SCORE = 80;

/** Warn band starts here. */
export const FATIGUE_WARN_SCORE = 55;

/**
 * Score from driving time + breaks, blended with regional HOS compliance.
 * - Base: driving toward comfort 2h + break credits.
 * - HOS near (≥85%) → at least warn; HOS over → critical / mustStop.
 */
export function computeFatigueScore(opts: {
  drivingSec: number;
  breaksTaken: number;
  sinceBreakSec?: number;
  weeklySec?: number;
  hosRegion?: HosRegionId;
}): FatigueScore {
  const drivingSec = Math.max(0, opts.drivingSec);
  const breaksTaken = Math.max(0, Math.floor(opts.breaksTaken));
  const sinceBreakSec = Math.max(0, opts.sinceBreakSec ?? drivingSec);
  const ratio = Math.min(1.25, drivingSec / DRIVING_BREAK_THRESHOLD_SEC);
  let score = Math.round(ratio * 85);
  score = Math.max(0, score - breaksTaken * 25);
  if (drivingSec >= DRIVING_BREAK_THRESHOLD_SEC && breaksTaken === 0) {
    score = Math.max(score, FATIGUE_CRITICAL_SCORE);
  }

  let hos: HosCompliance | undefined;
  if (opts.hosRegion) {
    hos = evaluateHosCompliance({
      region: opts.hosRegion,
      drivingSec,
      sinceBreakSec,
      weeklySec: opts.weeklySec,
    });
    if (hos.overLimit) score = Math.max(score, FATIGUE_CRITICAL_SCORE);
    else if (hos.nearLimit) score = Math.max(score, FATIGUE_WARN_SCORE);
    score = Math.max(score, Math.round(Math.min(1, hos.driveRatio) * 90));
  }

  score = Math.min(100, score);

  let level: FatigueScore['level'] = 'ok';
  if (score >= FATIGUE_CRITICAL_SCORE || hos?.overLimit) level = 'critical';
  else if (score >= FATIGUE_WARN_SCORE || hos?.nearLimit) level = 'warn';

  return {
    score,
    level,
    drivingSec,
    breaksTaken,
    mustStop: level === 'critical',
    hos,
  };
}

export const FATIGUE_STOP_TTS_FR =
  'Arrêt obligatoire. Votre score de fatigue est critique. Arrêtez-vous maintenant et reposez-vous.';

export const FATIGUE_STOP_TTS_EN =
  'Mandatory stop. Your fatigue score is critical. Pull over now and rest.';

export const FATIGUE_STOP_TTS_ES =
  'Parada obligatoria. Su puntuación de fatiga es crítica. Deténgase ahora y descanse.';

/** FR → EN → ES hard stop sequence. */
export const FATIGUE_STOP_TTS_SEQUENCE: readonly { language: string; text: string }[] = [
  { language: 'fr-FR', text: FATIGUE_STOP_TTS_FR },
  { language: 'en-US', text: FATIGUE_STOP_TTS_EN },
  { language: 'es-ES', text: FATIGUE_STOP_TTS_ES },
];

function speakOne(language: string, text: string): Promise<void> {
  return speakViaExpo(language, text, { volume: 1.0, rate: 0.92, pitch: 1.0 });
}

/**
 * Hard-to-ignore stop alert: speaks the trio twice at max volume.
 */
export async function speakFatigueStopAlert(opts?: {
  speak?: (language: string, text: string) => Promise<void>;
  repeat?: number;
}): Promise<void> {
  const speak = opts?.speak ?? speakOne;
  const repeat = Math.max(1, opts?.repeat ?? 2);
  await speechStop();
  for (let i = 0; i < repeat; i += 1) {
    for (const line of FATIGUE_STOP_TTS_SEQUENCE) {
      await speak(line.language, line.text);
    }
  }
}
