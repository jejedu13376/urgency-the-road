export type ModuleId =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17;

export interface ModuleMeta {
  id: ModuleId;
  title: string;
  short: string;
  href: string;
}

export interface PartQuote {
  id: string;
  name: string;
  category: 'mecanique' | 'electrique' | 'carrosserie' | 'fluide' | 'filtre';
  oemSku: string;
  priceNew: number;
  priceOem: number;
  priceAftermarket: number;
  laborHours: number;
  laborRate: number;
  currency: 'EUR' | 'USD' | 'CAD' | 'AUD';
  region: string;
}

export interface DtcCode {
  code: string;
  plainLanguage: string;
  severity: 'info' | 'warn' | 'critical';
  repairGuide: string[];
}

export interface PlacePin {
  id: string;
  kind: 'garage' | 'depannage' | 'pieces' | 'concession' | 'mobile' | 'depot_pl' | 'pesage';
  name: string;
  address: string;
  phone: string;
  hours: string;
  distanceKm: number;
  etaMin: number;
  lat: number;
  lon: number;
}

export interface MaintenanceItem {
  id: string;
  title: string;
  dueKm: number;
  dueDateIso?: string;
  status: 'a_faire' | 'planifie' | 'fait';
}

export interface TutorialItem {
  id: string;
  title: string;
  make: string;
  model: string;
  durationMin: number;
  steps: string[];
}

export interface FeedPost {
  id: string;
  author: string;
  title: string;
  caption: string;
  likes: number;
  comments: number;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: 'particulier' | 'routier_pro' | 'flotte';
  name: string;
  priceMonthly: number;
  currency: 'EUR';
  perks: string[];
}
