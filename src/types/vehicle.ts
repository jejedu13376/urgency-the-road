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
}
