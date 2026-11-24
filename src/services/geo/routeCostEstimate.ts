/**
 * Honest fuel / toll cost estimates for itinerary sheet.
 * TomTom may supply fuelConsumptionInLiters; otherwise local L/100 km + pump price.
 * Toll $ only when TomTom (or caller) provides an amount — never invent a fake invoice.
 */
import type { GpsVehicleMode } from '../prefs/gpsNavPrefs';

/** Approximate Québec/CA pump prices (CAD/L) — labeled as estimate in UI. */
export const FUEL_PRICE_CAD_PER_L: Record<GpsVehicleMode, number> = {
  voiture: 1.65,
  camion: 1.85,
};

/** Typical consumption L/100 km when API omits fuel. */
export const FUEL_L_PER_100KM: Record<GpsVehicleMode, number> = {
  voiture: 8.5,
  camion: 32,
};

/** Soft CAD/km for toll-road length when API reports toll sections but no $ amount. */
export const TOLL_ESTIMATE_CAD_PER_KM: Record<GpsVehicleMode, number> = {
  voiture: 0.12,
  camion: 0.35,
};

export type FuelCostEstimate = {
  liters: number;
  costCad: number;
  pricePerL: number;
  source: 'tomtom' | 'estimate';
};

export type TollCostEstimate = {
  /** Monetary amount when known; null = unknown (show section km only). */
  costCad: number | null;
  sectionKm: number;
  source: 'tomtom' | 'estimate' | 'none';
  label: string;
};

export function estimateFuelCost(
  distanceKm: number,
  mode: GpsVehicleMode,
  litersFromApi?: number | null,
): FuelCostEstimate {
  const pricePerL = FUEL_PRICE_CAD_PER_L[mode];
  if (litersFromApi != null && Number.isFinite(litersFromApi) && litersFromApi > 0) {
    const liters = Math.round(litersFromApi * 10) / 10;
    return {
      liters,
      costCad: Math.round(liters * pricePerL * 100) / 100,
      pricePerL,
      source: 'tomtom',
    };
  }
  const rate = FUEL_L_PER_100KM[mode];
  const liters = Math.round(distanceKm * rate) / 100;
  return {
    liters: Math.round(liters * 10) / 10,
    costCad: Math.round(liters * pricePerL * 100) / 100,
    pricePerL,
    source: 'estimate',
  };
}

export function estimateTollCost(
  mode: GpsVehicleMode,
  opts: {
    tollCostCad?: number | null;
    tollSectionKm?: number;
  },
): TollCostEstimate {
  const sectionKm = Math.max(0, opts.tollSectionKm ?? 0);
  if (opts.tollCostCad != null && Number.isFinite(opts.tollCostCad) && opts.tollCostCad > 0) {
    return {
      costCad: Math.round(opts.tollCostCad * 100) / 100,
      sectionKm,
      source: 'tomtom',
      label: `Péages ~${Math.round(opts.tollCostCad * 100) / 100} $ CAD`,
    };
  }
  if (sectionKm > 0.05) {
    const est = Math.round(sectionKm * TOLL_ESTIMATE_CAD_PER_KM[mode] * 100) / 100;
    return {
      costCad: est,
      sectionKm: Math.round(sectionKm * 10) / 10,
      source: 'estimate',
      label: `Péages estimés ~${est} $ · ${Math.round(sectionKm * 10) / 10} km à péage`,
    };
  }
  return {
    costCad: null,
    sectionKm: 0,
    source: 'none',
    label: 'Pas de péage détecté',
  };
}

export function formatCad(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} $`;
}
