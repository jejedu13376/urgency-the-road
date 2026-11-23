/**
 * Company support contact for Support screen / Settings link.
 * Override with EXPO_PUBLIC_SUPPORT_EMAIL (client-safe public address).
 */

export const DEFAULT_SUPPORT_EMAIL = 'support@urgence-mecanique.com';
export const SUPPORT_COMPANY = 'Urgence Mécanique';

export function getSupportEmail(): string {
  const fromEnv = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim().toLowerCase();
  if (fromEnv && fromEnv.includes('@')) return fromEnv;
  return DEFAULT_SUPPORT_EMAIL;
}

export function supportMailtoUrl(subject?: string, body?: string): string {
  const email = getSupportEmail();
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return params.length ? `mailto:${email}?${params.join('&')}` : `mailto:${email}`;
}
