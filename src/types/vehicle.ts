export type ContinentCode = 'NA' | 'EU' | 'AU' | 'AS';

export type Powertrain =
  | 'essence'
  | 'diesel'
  | 'hybride'
  | 'electrique'
  | 'gpl'
  | 'poids_lourd_diesel';

export type VehicleClass = 'voiture' | 'suv' | 'pickup' | 'poids_lourd';

export interface FluidCapacities {
  engineOilL: number;
  coolantL: number;
  washerL: number;
  fuelL?: number;
}

export interface CommonFailure {
  id: string;
  title: string;
  symptoms: string[];
  severity: 'faible' | 'moyen' | 'eleve';
}

export interface VehicleProfile {
  id: string;
  label: string;
  vin?: string;
  continent: ContinentCode;
  country: string;
  make: string;
  model: string;
  year: number;
  powertrain: Powertrain;
  vehicleClass: VehicleClass;
  fluids: FluidCapacities;
  commonFailures: CommonFailure[];
  odometerKm: number;
  unitSystem: 'metric' | 'imperial';
  currency: 'EUR' | 'USD' | 'CAD' | 'AUD';
  /**
   * Free-path tech notes (NHTSA fields / local fluids label).
   * Never populated from a paid OEM fluids API.
   */
  techNotes?: string[];
  /** Honesty marker for fluids — `local_estimate` until OEM API exists */
  fluidsSource?: 'local_estimate' | 'oem_api';
  /**
   * Original local temp id (`cascade-*` / …) stored on the Firestore doc after migrate.
   * Used by refreshCloud to drop already-migrated no-VIN temps (not fingerprint).
   */
  clientLocalId?: string;
}
