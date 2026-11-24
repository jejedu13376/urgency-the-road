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
  /** Optional make — slight free-path bias from common service manuals (not OEM API) */
  make?: string | null;
};

/** Make-aware oil bias (liters) — free heuristic table, never claims OEM. */
const MAKE_OIL_BIAS: Record<string, number> = {
  ford: 0.3,
  chevrolet: 0.25,
  gmc: 0.25,
  ram: 0.35,
  dodge: 0.2,
  toyota: -0.15,
  honda: -0.2,
  nissan: -0.1,
  hyundai: -0.1,
  kia: -0.1,
  volkswagen: 0.1,
  bmw: 0.35,
  mercedes: 0.4,
  'mercedes-benz': 0.4,
  audi: 0.25,
  volvo: 0.2,
  renault: -0.05,
  peugeot: -0.05,
  citroen: -0.05,
  fiat: -0.1,
};

function makeOilBias(make?: string | null): { bias: number; label?: string } {
  if (!make?.trim()) return { bias: 0 };
  const key = make.trim().toLowerCase();
  for (const [k, v] of Object.entries(MAKE_OIL_BIAS)) {
    if (key.includes(k)) return { bias: v, label: make.trim() };
  }
  return { bias: 0 };
}

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
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function withMakeNote(base: string, makeLabel?: string): string {
  return makeLabel
    ? `${base} · biais marque ${makeLabel} (heuristique libre)`
    : base;
}

export function estimateLocalFluids(input: FluidsEstimateInput): FluidsEstimate {
  const { vehicleClass, powertrain } = input;
  const disp =
    typeof input.displacementL === 'number' && Number.isFinite(input.displacementL)
      ? input.displacementL
      : null;
  const { bias, label: makeLabel } = makeOilBias(input.make);

  if (vehicleClass === 'poids_lourd' || powertrain === 'poids_lourd_diesel') {
    const oil = round1(
      (disp != null ? Math.min(48, Math.max(22, disp * 2.2)) : 32) + bias * 2,
    );
    return {
      fluids: { engineOilL: oil, coolantL: 45, washerL: 12, fuelL: 600 },
      label: withMakeNote('Fluides estimés localement (PL) — pas d’API fluides OEM', makeLabel),
      source: 'local_estimate',
    };
  }

  if (powertrain === 'electrique') {
    // Omit fuelL entirely — Firestore rejects nested `undefined` values.
    return {
      fluids: { engineOilL: 0, coolantL: disp != null && disp > 0 ? 8 : 6.5, washerL: 3 },
      label: withMakeNote(
        'Fluides estimés localement (EV — pas d’huile moteur) — pas d’API OEM',
        makeLabel,
      ),
      source: 'local_estimate',
    };
  }

  if (vehicleClass === 'pickup') {
    const oil = round1(
      (disp != null ? Math.min(10, Math.max(5.5, disp * 1.15)) : 7.5) + bias,
    );
    return {
      fluids: { engineOilL: oil, coolantL: 14, washerL: 4.5, fuelL: 90 },
      label: withMakeNote('Fluides estimés localement (pick-up) — pas d’API fluides OEM', makeLabel),
      source: 'local_estimate',
    };
  }

  if (vehicleClass === 'suv') {
    const oil = round1(
      (disp != null ? Math.min(7.5, Math.max(4.5, disp * 1.05)) : 5.5) + bias,
    );
    return {
      fluids: { engineOilL: oil, coolantL: 8, washerL: 4, fuelL: 65 },
      label: withMakeNote('Fluides estimés localement (SUV) — pas d’API fluides OEM', makeLabel),
      source: 'local_estimate',
    };
  }

  // voiture / hybride / essence / diesel / gpl
  let oil: number;
  if (disp != null) {
    oil = Math.min(7, Math.max(3.2, disp * 0.95 + 1.2));
  } else if (powertrain === 'diesel') {
    oil = 5.2;
  } else if (powertrain === 'hybride') {
    oil = 4.2;
  } else {
    oil = 4.5;
  }
  oil = round1(oil + bias);

  return {
    fluids: {
      engineOilL: oil,
      coolantL: powertrain === 'diesel' ? 7 : 5.5,
      washerL: 3.5,
      fuelL: powertrain === 'gpl' ? 40 : 50,
    },
    label: withMakeNote(
      disp != null
        ? `Fluides estimés localement (cylindrée ${disp} L) — pas d’API fluides OEM`
        : 'Fluides estimés localement (classe/motorisation) — pas d’API fluides OEM',
      makeLabel,
    ),
    source: 'local_estimate',
  };
}
