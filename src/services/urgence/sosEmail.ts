/**
 * SOS contact email — AsyncStorage persistence + light format validation.
 * Required before “send alert / share”; optional for dial-only emergency calls.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SOS_EMAIL_KEY = 'um.urgence.sosEmail.v1';

/** Basic email shape — not full RFC; enough to catch empty/garbage before share. */
const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSosEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidSosEmail(raw: string): boolean {
  const email = normalizeSosEmail(raw);
  if (!email || email.length > 254) return false;
  return BASIC_EMAIL_RE.test(email);
}

export async function loadSosEmail(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(SOS_EMAIL_KEY);
    if (!raw) return '';
    return normalizeSosEmail(raw);
  } catch {
    return '';
  }
}

export async function saveSosEmail(raw: string): Promise<string> {
  const email = normalizeSosEmail(raw);
  if (email) {
    await AsyncStorage.setItem(SOS_EMAIL_KEY, email);
  } else {
    await AsyncStorage.removeItem(SOS_EMAIL_KEY);
  }
  return email;
}

export type SosAlertPayload = {
  kind: 'sos_alert';
  email: string;
  lat: number;
  lon: number;
  accuracyM?: number;
  scanCode: string;
  suggestedEmergency: string;
  createdAt: string;
};

/** Build the share / emergency report message including the user’s email. */
export function formatSosAlertMessage(payload: SosAlertPayload): string {
  const acc =
    payload.accuracyM != null && Number.isFinite(payload.accuracyM)
      ? ` · ±${Math.round(payload.accuracyM)} m`
      : '';
  return [
    'URGENCE — alerte SOS Urgence Mécanique',
    `Email contact : ${payload.email}`,
    `GPS appareil : ${payload.lat}, ${payload.lon}${acc}`,
    `Code QR : ${payload.scanCode || '—'}`,
    `N° urgence suggéré : ${payload.suggestedEmergency}`,
    `Horodatage : ${payload.createdAt}`,
  ].join('\n');
}
