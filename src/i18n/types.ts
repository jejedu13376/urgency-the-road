/** Supported in-app locales (FR-first product). */
export const APP_LOCALES = ['fr', 'en', 'es'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'fr' || value === 'en' || value === 'es';
}
