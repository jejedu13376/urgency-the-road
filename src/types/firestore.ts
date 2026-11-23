/** Firestore document models — Urgence Mécanique (17 modules). */

export type UserRole = 'user' | 'garage_pro' | 'rescuer' | 'admin' | 'super_admin';
export type SubscriptionTier = 'free' | 'particulier' | 'routier_pro' | 'flotte' | 'rescuer';
export type ObdProtocol = 'OBD2' | 'EOBD' | 'J1939' | 'J1708';

export interface UserDoc {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  subscription: SubscriptionTier;
  subscriptionActive: boolean;
  rescuerBadgeId?: string;
  locale: 'fr' | 'en' | 'es';
  currency: 'EUR' | 'USD' | 'CAD' | 'AUD';
  createdAt: string;
  updatedAt: string;
}

export interface VehicleDoc {
  id: string;
  ownerUid: string;
  vin?: string;
  label: string;
  continent: string;
  country: string;
  make: string;
  model: string;
  year: number;
  powertrain: string;
  vehicleClass: string;
  fluids: { engineOilL: number; coolantL: number; washerL: number; fuelL?: number };
  commonFailures: { id: string; title: string; symptoms: string[]; severity: string }[];
  odometerKm: number;
  unitSystem: 'metric' | 'imperial';
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartDoc {
  id: string;
  vinPrefix?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  name: string;
  category: 'mecanique' | 'electrique' | 'carrosserie' | 'fluide' | 'filtre';
  oemSku: string;
  priceNew: number;
  priceOem: number;
  priceAftermarket: number;
  laborHours: number;
  laborRate: number;
  currency: string;
  region: string;
  buyUrlStub?: string;
  /** Real web search URLs (Google / Amazon / retailer) — not OEM API deep-links */
  buyUrls?: Array<{ label: string; url: string }>;
  updatedAt: string;
}

export interface ObdReadingDoc {
  id: string;
  ownerUid: string;
  vehicleId: string;
  protocol: ObdProtocol;
  dtcCodes: { code: string; plainLanguage: string; severity: string }[];
  sensors: Record<string, number | string>;
  connected: boolean;
  source: 'live' | 'mock' | 'stub';
  recordedAt: string;
}

export interface GarageDoc {
  id: string;
  name: string;
  kind: 'garage' | 'depannage' | 'pieces' | 'concession' | 'mobile' | 'depot_pl';
  address: string;
  phone: string;
  hours: string;
  lat: number;
  lon: number;
  ratingAvg?: number;
  ratingCount?: number;
  ownerUid?: string;
  updatedAt: string;
}

/**
 * Module 13 — medical fiche + personal QR (printed sticker/card per subscriber account).
 * Access tiers: public_limited | emergency_full (authorized rescuer). No electronic beacon IDs.
 */
export interface MedicalCardDoc {
  id: string;
  ownerUid: string;
  /** Unique personal QR payload / code printed on sticker or card (1 per subscriber). */
  scanCode: string;
  fullName: string;
  /** Postal / residence address shown on full emergency view. */
  address?: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  emergencyContacts: { name: string; phone: string }[];
  bloodType?: string;
  notes?: string;
  /** Subscriber must have an active paid plan to mint / keep a personal QR. */
  subscriberActive?: boolean;
  updatedAt: string;
}

/** Limited public preview after anonymous phone-camera QR scan. */
export type MedicalPublicPreview = {
  kind: 'public_limited';
  scanCode: string;
  brandLabel: string;
  sosHint: string;
  emergencyDial: string;
};

/** Full emergency view for authorized rescuers. */
export type MedicalEmergencyView = {
  kind: 'emergency_full';
  scanCode: string;
  fullName: string;
  address: string;
  emergencyContact: { name: string; phone: string } | null;
  bloodType?: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  notes?: string;
};

export interface RoadHazardDoc {
  id: string;
  reporterUid: string;
  kind: 'accident' | 'obstacle' | 'travaux' | 'radar' | 'danger' | 'autre';
  lat: number;
  lon: number;
  note?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface GpsPrefsDoc {
  id: string;
  ownerUid: string;
  mode: 'voiture' | 'camion';
  truckHeightM?: number;
  truckWidthM?: number;
  truckPtacT?: number;
  hazmat: boolean;
  preferApps: Array<'google' | 'waze' | 'apple'>;
  updatedAt: string;
}

export interface WeighStationDoc {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  region: 'EU' | 'NA' | 'AU';
  status: 'open' | 'closed' | 'unknown';
  litUp: boolean;
  heightLimitM?: number;
  weightLimitT?: number;
  updatedAt: string;
}

export interface QuoteDoc {
  id: string;
  ownerUid: string;
  vehicleId?: string;
  garageId?: string;
  lines: { label: string; partPrice: number; laborPrice: number }[];
  currency: string;
  overchargeRisk?: 'faible' | 'moyen' | 'eleve';
  source: 'manual' | 'scan_stub' | 'ai_stub';
  createdAt: string;
}

export interface InsuranceClaimDoc {
  id: string;
  ownerUid: string;
  vehicleId: string;
  insurer: string;
  claimNumber?: string;
  status: 'draft' | 'submitted' | 'open' | 'closed';
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface GarageRatingDoc {
  id: string;
  garageId: string;
  authorUid: string;
  stars: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
}

export interface AppointmentDoc {
  id: string;
  garageOwnerUid: string;
  clientUid?: string;
  clientName: string;
  vehicleLabel: string;
  status: 'requested' | 'confirmed' | 'in_shop' | 'done' | 'cancelled';
  scheduledAt: string;
  estimatedTotal?: number;
  currency?: string;
  notes?: string;
  createdAt: string;
}

/** YouTube suggestion stubs — never embed video files. */
export interface YoutubeSuggestionDoc {
  id: string;
  query: string;
  make?: string;
  model?: string;
  title: string;
  youtubeUrl: string;
  channel?: string;
  createdAt: string;
}

export const COLLECTIONS = {
  users: 'users',
  vehicles: 'vehicles',
  parts: 'parts',
  obdReadings: 'obdReadings',
  garages: 'garages',
  medicalCards: 'medicalCards',
  /** Doc id = scanCode. Rescuer get-only (no list). */
  medicalScanIndex: 'medicalScanIndex',
  roadHazards: 'roadHazards',
  gpsPrefs: 'gpsPrefs',
  weighStations: 'weighStations',
  quotes: 'quotes',
  insuranceClaims: 'insuranceClaims',
  garageRatings: 'garageRatings',
  appointments: 'appointments',
  youtubeSuggestions: 'youtubeSuggestions',
  learnedFailures: 'learnedFailures',
  feedPosts: 'feedPosts',
} as const;
