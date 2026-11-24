/**
 * Module 13 — truck/vehicle class speed limit from active fleet profile.
 * Loud TTS alert when GPS speed exceeds the profile limit.
 */
import type { ContinentCode, VehicleClass, VehicleProfile } from '../../types/vehicle';
import { speakViaExpo, speechStop } from './speechBridge';

/** km/h caps by vehicle class (highway default). */
export const SPEED_LIMIT_KMH_BY_CLASS: Record<VehicleClass, number> = {
  voiture: 130,
  suv: 130,
  pickup: 110,
  poids_lourd: 90,
};

/** Regional highway caps for heavy trucks (km/h). */
export const TRUCK_SPEED_LIMIT_BY_CONTINENT: Record<ContinentCode, number> = {
  EU: 90,
  NA: 105,
  AU: 100,
  AS: 80,
};

export type SpeedLimitProfile = {
  vehicleClass: VehicleClass;
  continent: ContinentCode;
  limitKmh: number;
  label: string;
};

export function resolveSpeedLimitFromProfile(
  profile: Pick<VehicleProfile, 'vehicleClass' | 'continent' | 'label'> | null | undefined,
): SpeedLimitProfile {
  const vehicleClass = profile?.vehicleClass ?? 'voiture';
  const continent = profile?.continent ?? 'EU';
  let limitKmh = SPEED_LIMIT_KMH_BY_CLASS[vehicleClass] ?? 130;
  if (vehicleClass === 'poids_lourd') {
    limitKmh = TRUCK_SPEED_LIMIT_BY_CONTINENT[continent] ?? 90;
  }
  return {
    vehicleClass,
    continent,
    limitKmh,
    label: profile?.label ?? vehicleClass,
  };
}

export function mpsToKmh(speedMps: number | null | undefined): number | null {
  if (typeof speedMps !== 'number' || !Number.isFinite(speedMps) || speedMps < 0) return null;
  return speedMps * 3.6;
}

/**
 * True when current speed exceeds the profile limit by at least `toleranceKmh`.
 * Default tolerance 3 km/h to avoid GPS noise flicker.
 */
export function isOverSpeedLimit(opts: {
  speedMps: number | null | undefined;
  limitKmh: number;
  toleranceKmh?: number;
}): boolean {
  const kmh = mpsToKmh(opts.speedMps);
  if (kmh == null) return false;
  const tol = opts.toleranceKmh ?? 3;
  return kmh > opts.limitKmh + tol;
}

export const OVERSPEED_TTS_FR =
  'Attention vitesse. Vous dépassez la limite autorisée pour votre type de véhicule. Ralentissez immédiatement.';

export const OVERSPEED_TTS_EN =
  'Speed alert. You are over the limit for your vehicle type. Slow down immediately.';

function speakOne(language: string, text: string): Promise<void> {
  return speakViaExpo(language, text, { volume: 1.0, rate: 1.0, pitch: 1.1 });
}

/** Loud overspeed alert — hard to miss. */
export async function speakOverspeedAlert(opts?: {
  speak?: (language: string, text: string) => Promise<void>;
  cycles?: number;
  limitKmh?: number;
}): Promise<void> {
  const speak = opts?.speak ?? speakOne;
  const cycles = Math.max(1, opts?.cycles ?? 2);
  const limitBit =
    typeof opts?.limitKmh === 'number'
      ? ` Limit ${Math.round(opts.limitKmh)} kilometers per hour.`
      : '';
  await speechStop();
  for (let i = 0; i < cycles; i += 1) {
    await speak('fr-FR', OVERSPEED_TTS_FR);
    await speak('en-US', OVERSPEED_TTS_EN + limitBit);
  }
}
