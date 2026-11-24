/**
 * Local credentials + personal profile for Settings / first-time register gate.
 * AsyncStorage only — Firebase Auth is the live source when configured.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_PROFILE_LOCAL_KEY = 'um.user.profile.local.v1';
export const REGISTER_COMPLETED_KEY = 'um.register.completed.v1';

export type LocalUserProfile = {
  email: string;
  displayName: string;
  phone: string;
  city: string;
  /** Never store plaintext passwords long-term — last used email only for autofill. */
  lastEmail: string;
  updatedAt: string;
};

export const DEFAULT_LOCAL_USER_PROFILE: LocalUserProfile = {
  email: '',
  displayName: '',
  phone: '',
  city: '',
  lastEmail: '',
  updatedAt: '',
};

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  if (!email || email.length > 254) return false;
  return BASIC_EMAIL_RE.test(email);
}

/** Cahier M15 — min 6, 1 uppercase, 1 special. */
export function validatePassword(pw: string): { ok: boolean; msgFr: string; msgKey: 'ok' | 'bad' } {
  const ok = pw.length >= 6 && /[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
  return {
    ok,
    msgKey: ok ? 'ok' : 'bad',
    msgFr: ok
      ? 'Mot de passe conforme (6+ · 1 majuscule · 1 caractère spécial).'
      : 'Invalidé : min. 6 caractères, 1 majuscule, 1 caractère spécial.',
  };
}

export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return true; // optional
  return digits.length >= 8 && digits.length <= 16;
}

export function isValidDisplayName(raw: string): boolean {
  const name = raw.trim();
  if (!name) return true; // optional on settings save; required on register
  return name.length >= 2 && name.length <= 80;
}

export async function loadLocalUserProfile(): Promise<LocalUserProfile> {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_LOCAL_KEY);
    if (!raw) return { ...DEFAULT_LOCAL_USER_PROFILE };
    return { ...DEFAULT_LOCAL_USER_PROFILE, ...(JSON.parse(raw) as LocalUserProfile) };
  } catch {
    return { ...DEFAULT_LOCAL_USER_PROFILE };
  }
}

export async function saveLocalUserProfile(
  patch: Partial<LocalUserProfile>,
): Promise<LocalUserProfile> {
  const prev = await loadLocalUserProfile();
  const email = patch.email != null ? normalizeEmail(patch.email) : prev.email;
  const next: LocalUserProfile = {
    ...prev,
    ...patch,
    email,
    lastEmail: email || prev.lastEmail,
    displayName: patch.displayName != null ? patch.displayName.trim() : prev.displayName,
    phone: patch.phone != null ? patch.phone.trim() : prev.phone,
    city: patch.city != null ? patch.city.trim() : prev.city,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(USER_PROFILE_LOCAL_KEY, JSON.stringify(next));
  return next;
}

export async function isRegisterCompleted(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(REGISTER_COMPLETED_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function markRegisterCompleted(): Promise<void> {
  await AsyncStorage.setItem(REGISTER_COMPLETED_KEY, '1');
}

/** Smart autofill seed: Auth profile wins, then local lastEmail / fields. */
export function mergeAutofill(
  local: LocalUserProfile,
  auth?: { email?: string | null; displayName?: string | null } | null,
): Pick<LocalUserProfile, 'email' | 'displayName' | 'phone' | 'city'> {
  return {
    email: normalizeEmail(auth?.email || local.email || local.lastEmail || ''),
    displayName: (auth?.displayName || local.displayName || '').trim(),
    phone: local.phone,
    city: local.city,
  };
}
