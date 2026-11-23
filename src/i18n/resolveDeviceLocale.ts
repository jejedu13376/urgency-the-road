import { getLocales } from 'expo-localization';
import { isAppLocale, type AppLocale } from './types';

/**
 * Default locale policy (FR-first product voice):
 * 1) First device languageCode in {fr,en,es}
 * 2) Else French
 */
export function resolveDeviceLocale(): AppLocale {
  try {
    for (const loc of getLocales()) {
      const code = loc.languageCode?.toLowerCase();
      if (isAppLocale(code)) return code;
    }
  } catch {
    /* web / headless — fall through */
  }
  return 'fr';
}

export function localeTag(locale: AppLocale): string {
  switch (locale) {
    case 'en':
      return 'en-US';
    case 'es':
      return 'es-ES';
    default:
      return 'fr-FR';
  }
}
