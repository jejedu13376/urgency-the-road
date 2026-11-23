import { I18n } from 'i18n-js';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { resolveDeviceLocale } from './resolveDeviceLocale';
import type { AppLocale } from './types';

export { APP_LOCALES, isAppLocale, type AppLocale } from './types';
export { loadStoredLocale, saveStoredLocale, LOCALE_STORAGE_KEY } from './localeStorage';
export { resolveDeviceLocale, localeTag } from './resolveDeviceLocale';
export { fr } from './fr';

export const i18n = new I18n({ fr, en, es });
i18n.defaultLocale = 'fr';
i18n.enableFallback = true;
i18n.locale = resolveDeviceLocale();

export type TranslateOptions = Record<string, string | number>;

export function t(key: string, options?: TranslateOptions): string {
  return i18n.t(key, options);
}

export function setI18nLocale(locale: AppLocale): void {
  i18n.locale = locale;
}

/** Flat string bag injected into the Leaflet map HTML/JS. */
export type GpsMapI18n = {
  car: string;
  carSub: string;
  truck: string;
  truckSub: string;
  statusTap: string;
  pickerTitle: string;
  pickerHint: string;
  start: string;
  originTooltip: string;
  gpsDeniedSilent: string;
  modeTruckTap: string;
  modeCarTap: string;
  needGpsBeforeRoute: string;
  needGpsNoRoute: string;
  needGpsAuthorize: string;
  calculatingTruck: string;
  calculatingCar: string;
  routeUnavailable: string;
  routeReady: string;
  routeDisplayFail: string;
  gpsOkTruck: string;
  gpsOkCar: string;
  gpsDeniedBtn: string;
  navigatingTruck: string;
  navigatingCar: string;
  arrived: string;
  pickerHintCoordsTpl: string;
  lang: string;
};

export function getGpsMapI18n(): GpsMapI18n {
  return {
    car: t('gps.car'),
    carSub: t('gps.carSub'),
    truck: t('gps.truck'),
    truckSub: t('gps.truckSub'),
    statusTap: t('gps.statusTap'),
    pickerTitle: t('gps.pickerTitle'),
    pickerHint: t('gps.pickerHint'),
    start: t('gps.start'),
    originTooltip: t('gps.originTooltip'),
    gpsDeniedSilent: t('gps.gpsDeniedSilent'),
    modeTruckTap: t('gps.modeTruckTap'),
    modeCarTap: t('gps.modeCarTap'),
    needGpsBeforeRoute: t('gps.needGpsBeforeRoute'),
    needGpsNoRoute: t('gps.needGpsNoRoute'),
    needGpsAuthorize: t('gps.needGpsAuthorize'),
    calculatingTruck: t('gps.calculatingTruck'),
    calculatingCar: t('gps.calculatingCar'),
    routeUnavailable: t('gps.routeUnavailable'),
    routeReady: t('gps.routeReady'),
    routeDisplayFail: t('gps.routeDisplayFail'),
    gpsOkTruck: t('gps.gpsOkTruck'),
    gpsOkCar: t('gps.gpsOkCar'),
    gpsDeniedBtn: t('gps.gpsDeniedBtn'),
    navigatingTruck: t('gps.navigatingTruck'),
    navigatingCar: t('gps.navigatingCar'),
    arrived: t('gps.arrived'),
    pickerHintCoordsTpl: t('gps.pickerHintCoords', { lat: '{lat}', lon: '{lon}' }),
    lang: i18n.locale,
  };
}
