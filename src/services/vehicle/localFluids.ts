/**
 * Module 1 — local fluid capacity estimator (free path).
 * Honest: not an OEM fluids API — displacement / class heuristics only.
 */
import type { FluidCapacities, Powertrain, VehicleClass } from '../../types/vehicle';

export type FluidsEstimateInput = {
  vehicleClass: VehicleClass;
  powertrain: Powertrain;
  /** Liters, from NHTSA Displacement (L) when available */
  displacementL?: number | null;
};

export type FluidsEstimate = {
  fluids: FluidCapacities;
  /** User-facing honesty label — never claim OEM API */
  label: string;
  source: 'local_estimate';
};

/**
 * Estimate fluid capacities from class / powertrain / optional displacement.
 * Values are indicative for UX; OEM service manuals remain the blocked path.
 */
export function estimateLocalFluids(input: FluidsEstimateInput): FluidsEstimate {
  const { vehicleClass, powertrain } = input;
  const disp =
    typeof input.displacementL === 'number' && Number.isFinite(input.displacementL)
      ? input.displacementL
      : null;

  if (vehicleClass === 'poids_lourd' || powertrain === 'poids_lourd_diesel') {
    const oil = disp != null ? Math.round(Math.min(48, Math.max(22, disp * 2.2)) * 10) / 10 : 32;
    return {
      fluids: { engineOilL: oil, coolantL: 45, washerL: 12, fuelL: 600 },
      label: 'Fluides estimés localement (PL) — pas d’API fluides OEM',
      source: 'local_estimate',
    };
  }

  if (powertrain === 'electrique') {
    return {
      fluids: { engineOilL: 0, coolantL: disp != null && disp > 0 ? 8 : 6.5, washerL: 3, fuelL: undefined },
      label: 'Fluides estimés localement (EV — pas d’huile moteur) — pas d’API OEM',
      source: 'local_estimate',
    };
  }

  if (vehicleClass === 'pickup') {
    const oil = disp != null ? Math.round(Math.min(10, Math.max(5.5, disp * 1.15)) * 10) / 10 : 7.5;
    return {
      fluids: { engineOilL: oil, coolantL: 14, washerL: 4.5, fuelL: 90 },
      label: 'Fluides estimés localement (pick-up) — pas d’API fluides OEM',
      source: 'local_estimate',
    };
  }

  if (vehicleClass === 'suv') {
    const oil = disp != null ? Math.round(Math.min(7.5, Math.max(4.5, disp * 1.05)) * 10) / 10 : 5.5;
    return {
      fluids: { engineOilL: oil, coolantL: 8, washerL: 4, fuelL: 65 },
      label: 'Fluides estimés localement (SUV) — pas d’API fluides OEM',
      source: 'local_estimate',
    };
  }

  // voiture / hybride / essence / diesel / gpl
  let oil: number;
  if (disp != null) {
    oil = Math.round(Math.min(7, Math.max(3.2, disp * 0.95 + 1.2)) * 10) / 10;
  } else if (powertrain === 'diesel') {
    oil = 5.2;
  } else if (powertrain === 'hybride') {
    oil = 4.2;
  } else {
    oil = 4.5;
  }

  return {
    fluids: {
      engineOilL: oil,
      coolantL: powertrain === 'diesel' ? 7 : 5.5,
      washerL: 3.5,
      fuelL: powertrain === 'gpl' ? 40 : 50,
    },
    label:
      disp != null
        ? `Fluides estimés localement (cylindrée ${disp} L) — pas d’API fluides OEM`
        : 'Fluides estimés localement (classe/motorisation) — pas d’API fluides OEM',
    source: 'local_estimate',
  };
}
