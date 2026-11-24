/**
 * Module 13 — secours product enrollment (software path).
 * Local KYC checklist + badge mint. Cloud role elevation stays admin/backend
 * (Firestore freezes role/subscription/rescuerBadgeId for self-updates).
 * DEV / soft-auth can overlay a rescuer profile for emergency_full testing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserDoc } from '../../types/firestore';
import { isDevSoftAuth } from '../firebase/devSoftAuth';

const KEY_PREFIX = 'um.rescuer.enrollment.v1.';
/** Legacy unscoped key — cleared on load/sign-out to stop cross-account leaks. */
const LEGACY_KEY = 'um.rescuer.enrollment.v1';

export type RescuerChecklistId =
  | 'id_pro'
  | 'org_attestation'
  | 'phi_training'
  | 'tos_secours';

export type RescuerEnrollment = {
  uid: string;
  badgeId: string;
  orgName: string;
  checklist: Record<RescuerChecklistId, boolean>;
  /** draft → editing · submitted → waiting admin · soft_active → DEV overlay only */
  status: 'draft' | 'submitted' | 'soft_active';
  submittedAt?: string;
  updatedAt: string;
};

export const RESCUER_CHECKLIST: { id: RescuerChecklistId; label: string }[] = [
  { id: 'id_pro', label: 'Pièce / matricule professionnel vérifié' },
  { id: 'org_attestation', label: 'Attestation organisme / caserne / société' },
  { id: 'phi_training', label: 'Formation confidentialité données médicales (PHI)' },
  { id: 'tos_secours', label: 'CGU accès secours acceptées' },
];

function storageKey(uid: string): string {
  return `${KEY_PREFIX}${uid}`;
}

function emptyChecklist(): Record<RescuerChecklistId, boolean> {
  return {
    id_pro: false,
    org_attestation: false,
    phi_training: false,
    tos_secours: false,
  };
}

export function defaultEnrollment(uid: string): RescuerEnrollment {
  return {
    uid,
    badgeId: '',
    orgName: '',
    checklist: emptyChecklist(),
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };
}

export async function loadRescuerEnrollment(uid: string | null): Promise<RescuerEnrollment | null> {
  if (!uid) return null;
  try {
    // Drop legacy unscoped blob so a prior soft_active cannot leak across accounts.
    await AsyncStorage.removeItem(LEGACY_KEY);
    const raw = await AsyncStorage.getItem(storageKey(uid));
    if (!raw) return defaultEnrollment(uid);
    const parsed = JSON.parse(raw) as Partial<RescuerEnrollment>;
    if (parsed.uid && parsed.uid !== uid) {
      return defaultEnrollment(uid);
    }
    return {
      ...defaultEnrollment(uid),
      ...parsed,
      checklist: { ...emptyChecklist(), ...(parsed.checklist ?? {}) },
      uid,
    };
  } catch {
    return defaultEnrollment(uid);
  }
}

export async function saveRescuerEnrollment(enrollment: RescuerEnrollment): Promise<RescuerEnrollment> {
  if (!enrollment.uid) {
    throw new Error('rescuerEnrollment: uid requis');
  }
  const next: RescuerEnrollment = {
    ...enrollment,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(storageKey(enrollment.uid), JSON.stringify(next));
  return next;
}

export async function clearRescuerEnrollment(uid: string | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
    if (uid) await AsyncStorage.removeItem(storageKey(uid));
  } catch {
    /* ignore */
  }
}

export function checklistComplete(enrollment: RescuerEnrollment): boolean {
  return RESCUER_CHECKLIST.every((c) => enrollment.checklist[c.id]);
}

/**
 * Submit enrollment. Soft-auth / DEV → soft_active overlay.
 * Production → submitted (awaits admin Firestore role write).
 */
export async function submitRescuerEnrollment(
  enrollment: RescuerEnrollment,
): Promise<{ enrollment: RescuerEnrollment; message: string }> {
  if (!enrollment.uid) {
    return {
      enrollment,
      message: 'Connexion requise avant soumission secours (uid manquant).',
    };
  }
  const badge = enrollment.badgeId.trim().toUpperCase();
  if (!badge || badge.length < 4) {
    return {
      enrollment,
      message: 'Badge / n° pro requis (min. 4 caractères) avant soumission.',
    };
  }
  if (!checklistComplete(enrollment)) {
    return {
      enrollment,
      message: 'Checklist KYC incomplète — cochez toutes les cases.',
    };
  }

  const soft = isDevSoftAuth();
  const next: RescuerEnrollment = {
    ...enrollment,
    badgeId: badge,
    status: soft ? 'soft_active' : 'submitted',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveRescuerEnrollment(next);
  return {
    enrollment: next,
    message: soft
      ? 'SOFT secours actif (DEV) — rôle rescuer overlay local ; PHI testable. Validation cloud admin = externe.'
      : 'Demande secours enregistrée localement — élévation rôle Firestore = admin / backend (pas de self-write).',
  };
}

/**
 * Overlay rescuer fields onto Auth profile — DEV soft-auth only.
 * Never elevate from a leftover soft_active blob in production builds.
 */
export function applyRescuerOverlay(
  profile: UserDoc | null,
  enrollment: RescuerEnrollment | null,
): UserDoc | null {
  if (!profile || !enrollment) return profile;
  if (!isDevSoftAuth()) return profile;
  if (enrollment.uid !== profile.uid) return profile;
  const active =
    enrollment.status === 'soft_active' ||
    (enrollment.status === 'submitted' && checklistComplete(enrollment));
  if (!active) return profile;
  return {
    ...profile,
    role: 'rescuer',
    subscription: 'rescuer',
    subscriptionActive: true,
    rescuerBadgeId: enrollment.badgeId || profile.rescuerBadgeId,
    updatedAt: new Date().toISOString(),
  };
}

export const SECOURS_PRODUCT_LIVE =
  'Auth secours produit LIVE — checklist KYC + badge local ; validation cloud admin = externe.';
