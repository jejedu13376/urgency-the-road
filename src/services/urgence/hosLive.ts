/**
 * Live personal HOS readout: legal hours left today + next mandatory stop clock.
 * Updates from motion-based driving counters; region = CA | US | EU | AU.
 */
import {
  evaluateHosCompliance,
  getHosLimits,
  type HosCompliance,
  type HosRegionId,
} from './hosRegs';

export type HosLiveStatus = {
  region: HosRegionId;
  regionLabel: string;
  /** Seconds of legal driving still available today / shift (floored at 0). */
  hoursLeftSec: number;
  hoursLeftLabel: string;
  /** Wall-clock when the next mandatory stop is due (break or max-drive, whichever sooner). */
  nextMandatoryStopAt: Date | null;
  nextMandatoryStopLabel: string;
  /** Seconds until that stop from `now`. */
  nextMandatoryStopInSec: number;
  compliance: HosCompliance;
  citation: string;
};

export function formatHosDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

export function formatStopClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Compute live HOS personal display for the active country profile.
 */
export function computeHosLiveStatus(opts: {
  region: HosRegionId;
  /** Driving accumulated in current day/shift. */
  drivingSec: number;
  /** Driving since last qualifying break. */
  sinceBreakSec: number;
  weeklySec?: number;
  now?: Date;
}): HosLiveStatus {
  const now = opts.now ?? new Date();
  const limits = getHosLimits(opts.region);
  const compliance = evaluateHosCompliance({
    region: opts.region,
    drivingSec: opts.drivingSec,
    sinceBreakSec: opts.sinceBreakSec,
    weeklySec: opts.weeklySec,
  });

  const hoursLeftSec = Math.max(0, limits.maxDriveSec - Math.max(0, opts.drivingSec));

  const untilMaxDrive = hoursLeftSec;
  const untilBreak = Math.max(0, limits.breakAfterDriveSec - Math.max(0, opts.sinceBreakSec));
  const nextMandatoryStopInSec = Math.min(untilMaxDrive, untilBreak);

  const nextMandatoryStopAt =
    nextMandatoryStopInSec <= 0
      ? now
      : new Date(now.getTime() + nextMandatoryStopInSec * 1000);

  let nextMandatoryStopLabel: string;
  if (nextMandatoryStopInSec <= 0) {
    nextMandatoryStopLabel =
      compliance.breakOverdue && untilMaxDrive > 0
        ? `STOP now — break overdue (${limits.minBreakSec / 60} min)`
        : 'STOP now — legal hours exhausted';
  } else if (untilBreak <= untilMaxDrive) {
    nextMandatoryStopLabel = `Break by ${formatStopClock(nextMandatoryStopAt)} (${formatHosDuration(untilBreak)} · ≥${limits.minBreakSec / 60} min)`;
  } else {
    nextMandatoryStopLabel = `Max drive ends ${formatStopClock(nextMandatoryStopAt)} (${formatHosDuration(untilMaxDrive)})`;
  }

  return {
    region: opts.region,
    regionLabel: limits.label,
    hoursLeftSec,
    hoursLeftLabel: formatHosDuration(hoursLeftSec),
    nextMandatoryStopAt,
    nextMandatoryStopLabel,
    nextMandatoryStopInSec,
    compliance,
    citation: limits.citation,
  };
}
