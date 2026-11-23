/**
 * Trucker vehicle + trailer profile — AsyncStorage.
 * Feeds GPS truck costing (height/width/length/weight/axles) and advisory route rules.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveGpsNavPrefs } from './gpsNavPrefs';

/** Tracteur (« trek ») and other HD configurations. */
export type TruckType = 'trek' | 'porteur' | 'semi' | 'road_train' | 'other';

export type TrailerType =
  | 'none'
  | 'flatbed'
  | 'tanker'
  | 'dry_van'
  | 'reefer'
  | 'livestock'
  | 'car_carrier'
  | 'lowboy'
  | 'container'
  | 'tipper'
  | 'other';

export type SpecialEquipment =
  | 'hazmat_adr'
  | 'reefer_unit'
  | 'liftgate'
  | 'tarp'
  | 'chains'
  | 'wide_load'
  | 'side_loader'
  | 'pump';

export type TruckerProfile = {
  truckType: TruckType;
  make: string;
  model: string;
  year: number;
  lengthM: number;
  widthM: number;
  heightM: number;
  weightT: number;
  axles: number;
  trailerType: TrailerType;
  specialEquipment: SpecialEquipment[];
  /** Jurisdiction hint for advisory regs (not certified clearance). */
  region: 'EU' | 'NA' | 'AU';
  updatedAt: string;
};

export const TRUCKER_PROFILE_KEY = 'um.trucker.profile.v1';

export const TRUCK_TYPE_OPTIONS: { id: TruckType; labelFr: string; labelEn: string }[] = [
  { id: 'trek', labelFr: 'Trek / tracteur', labelEn: 'Tractor (trek)' },
  { id: 'porteur', labelFr: 'Porteur', labelEn: 'Straight truck' },
  { id: 'semi', labelFr: 'Semi-remorque (attelage)', labelEn: 'Semi combo' },
  { id: 'road_train', labelFr: 'Train routier', labelEn: 'Road train' },
  { id: 'other', labelFr: 'Autre', labelEn: 'Other' },
];

export const TRAILER_TYPE_OPTIONS: { id: TrailerType; labelFr: string; labelEn: string }[] = [
  { id: 'none', labelFr: 'Sans remorque', labelEn: 'No trailer' },
  { id: 'flatbed', labelFr: 'Plateau (flatbed)', labelEn: 'Flatbed' },
  { id: 'tanker', labelFr: 'Citerne (tanker)', labelEn: 'Tanker' },
  { id: 'dry_van', labelFr: 'Fourgon / dry van', labelEn: 'Dry van' },
  { id: 'reefer', labelFr: 'Frigo (reefer)', labelEn: 'Reefer' },
  { id: 'livestock', labelFr: 'Bétail (livestock)', labelEn: 'Livestock' },
  { id: 'car_carrier', labelFr: 'Porte-voitures', labelEn: 'Car carrier' },
  { id: 'lowboy', labelFr: 'Surbaissée (lowboy)', labelEn: 'Lowboy' },
  { id: 'container', labelFr: 'Porte-conteneur', labelEn: 'Container' },
  { id: 'tipper', labelFr: 'Benne / tipper', labelEn: 'Tipper' },
  { id: 'other', labelFr: 'Autre remorque', labelEn: 'Other trailer' },
];

export const SPECIAL_EQUIPMENT_OPTIONS: { id: SpecialEquipment; labelFr: string; labelEn: string }[] = [
  { id: 'hazmat_adr', labelFr: 'ADR / hazmat', labelEn: 'ADR / hazmat' },
  { id: 'reefer_unit', labelFr: 'Groupe frigorifique', labelEn: 'Reefer unit' },
  { id: 'liftgate', labelFr: 'Hayon', labelEn: 'Liftgate' },
  { id: 'tarp', labelFr: 'Bâche / tarp', labelEn: 'Tarp' },
  { id: 'chains', labelFr: 'Chaînes / sangles', labelEn: 'Chains / straps' },
  { id: 'wide_load', labelFr: 'Convoi exceptionnel', labelEn: 'Wide / oversize' },
  { id: 'side_loader', labelFr: 'Side-loader', labelEn: 'Side-loader' },
  { id: 'pump', labelFr: 'Pompe citerne', labelEn: 'Tanker pump' },
];

export const DEFAULT_TRUCKER_PROFILE: TruckerProfile = {
  truckType: 'trek',
  make: '',
  model: '',
  year: new Date().getFullYear(),
  lengthM: 16.5,
  widthM: 2.55,
  heightM: 4.0,
  weightT: 40,
  axles: 5,
  trailerType: 'dry_van',
  specialEquipment: [],
  region: 'EU',
  updatedAt: new Date(0).toISOString(),
};

function numOr(fallback: number, raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeEquipment(raw: unknown): SpecialEquipment[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(SPECIAL_EQUIPMENT_OPTIONS.map((o) => o.id));
  return raw.filter((x): x is SpecialEquipment => typeof x === 'string' && allowed.has(x as SpecialEquipment));
}

export function normalizeTruckerProfile(parsed: Partial<TruckerProfile> | null | undefined): TruckerProfile {
  const d = DEFAULT_TRUCKER_PROFILE;
  const truckType = TRUCK_TYPE_OPTIONS.some((o) => o.id === parsed?.truckType)
    ? (parsed!.truckType as TruckType)
    : d.truckType;
  const trailerType = TRAILER_TYPE_OPTIONS.some((o) => o.id === parsed?.trailerType)
    ? (parsed!.trailerType as TrailerType)
    : d.trailerType;
  const region =
    parsed?.region === 'NA' || parsed?.region === 'AU' || parsed?.region === 'EU' ? parsed.region : d.region;
  const year = Math.round(numOr(d.year, parsed?.year));
  return {
    truckType,
    make: typeof parsed?.make === 'string' ? parsed.make.trim() : '',
    model: typeof parsed?.model === 'string' ? parsed.model.trim() : '',
    year: year >= 1950 && year <= 2100 ? year : d.year,
    lengthM: Math.min(30, Math.max(4, numOr(d.lengthM, parsed?.lengthM))),
    widthM: Math.min(4.5, Math.max(1.8, numOr(d.widthM, parsed?.widthM))),
    heightM: Math.min(5.5, Math.max(2.2, numOr(d.heightM, parsed?.heightM))),
    weightT: Math.min(80, Math.max(3.5, numOr(d.weightT, parsed?.weightT))),
    axles: Math.round(Math.min(12, Math.max(2, numOr(d.axles, parsed?.axles)))),
    trailerType,
    specialEquipment: sanitizeEquipment(parsed?.specialEquipment),
    region,
    updatedAt:
      typeof parsed?.updatedAt === 'string' && parsed.updatedAt ? parsed.updatedAt : new Date().toISOString(),
  };
}

export async function loadTruckerProfile(): Promise<TruckerProfile> {
  try {
    const raw = await AsyncStorage.getItem(TRUCKER_PROFILE_KEY);
    if (!raw) return { ...DEFAULT_TRUCKER_PROFILE };
    return normalizeTruckerProfile(JSON.parse(raw) as Partial<TruckerProfile>);
  } catch {
    return { ...DEFAULT_TRUCKER_PROFILE };
  }
}

/** Persist profile and sync gabarit into GPS nav prefs (Valhalla truck costing). */
export async function saveTruckerProfile(patch: Partial<TruckerProfile>): Promise<TruckerProfile> {
  const prev = await loadTruckerProfile();
  const next = normalizeTruckerProfile({
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await AsyncStorage.setItem(TRUCKER_PROFILE_KEY, JSON.stringify(next));
  await saveGpsNavPrefs({
    mode: 'camion',
    truckHeightM: next.heightM,
    truckWidthM: next.widthM,
    truckPtacT: next.weightT,
    truckLengthM: next.lengthM,
    axleCount: next.axles,
    hazmat: next.specialEquipment.includes('hazmat_adr'),
  });
  return next;
}

export function truckTypeLabel(id: TruckType, lang: 'fr' | 'en' = 'fr'): string {
  const hit = TRUCK_TYPE_OPTIONS.find((o) => o.id === id);
  if (!hit) return id;
  return lang === 'en' ? hit.labelEn : hit.labelFr;
}

export function trailerTypeLabel(id: TrailerType, lang: 'fr' | 'en' = 'fr'): string {
  const hit = TRAILER_TYPE_OPTIONS.find((o) => o.id === id);
  if (!hit) return id;
  return lang === 'en' ? hit.labelEn : hit.labelFr;
}

export function equipmentLabel(id: SpecialEquipment, lang: 'fr' | 'en' = 'fr'): string {
  const hit = SPECIAL_EQUIPMENT_OPTIONS.find((o) => o.id === id);
  if (!hit) return id;
  return lang === 'en' ? hit.labelEn : hit.labelFr;
}
