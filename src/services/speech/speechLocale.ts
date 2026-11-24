/**
 * Locale helpers for TTS — no Expo/RN imports (safe for Node unit tests).
 */
import type { AppLocale } from '../../i18n/types';

/** Slightly slow, steady — easier for dyslexic listeners. */
export const DYSLEXIA_SPEECH_RATE = 0.85;
export const DYSLEXIA_SPEECH_PITCH = 1.0;

export function speechLanguageForLocale(locale: AppLocale): string {
  switch (locale) {
    case 'en':
      return 'en-US';
    case 'es':
      return 'es-ES';
    default:
      return 'fr-FR';
  }
}
