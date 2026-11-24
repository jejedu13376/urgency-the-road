import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase, isFirebaseConfigured } from '../../firebase/config';
import type { UserDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { isDevSoftAuth, isPermissionDenied } from './devSoftAuth';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

const MOCK_USER: UserDoc = {
  uid: 'mock-local-user',
  email: 'demo@urgence-mecanique.local',
  displayName: 'Démo locale',
  role: 'user',
  subscription: 'particulier',
  subscriptionActive: false,
  locale: 'fr',
  currency: 'EUR',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function authErrorMessage(e: unknown): string {
  const code =
    e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'Cet email est déjà inscrit.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/invalid-email': 'Email invalide.',
    'auth/weak-password': 'Mot de passe trop faible.',
    'auth/user-not-found': 'Compte introuvable.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/too-many-requests': 'Trop de tentatives — réessayez plus tard.',
    'auth/network-request-failed': 'Réseau indisponible.',
  };
  if (code && map[code]) return map[code];
  return e instanceof Error ? e.message : String(e);
}

/** Firestore rejects `undefined` field values — omit them. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

function profileFromAuth(
  uid: string,
  email: string,
  displayName?: string | null,
): UserDoc {
  const name = displayName?.trim();
  const base: UserDoc = {
    uid,
    email,
    role: 'user',
    subscription: 'free',
    subscriptionActive: false,
    locale: 'fr',
    currency: 'EUR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (name) base.displayName = name;
  return base;
}

/**
 * Ensure users/{uid} exists so refresh() does not wipe a successful sign-in.
 * On permission-denied, soft-return an in-memory Auth-derived profile so Expo
 * never crashes on bootstrap (not medical PHI; no world-open rules required).
 */
async function ensureUserDoc(
  uid: string,
  email: string,
  displayName?: string | null,
): Promise<UserDoc> {
  const fb = getFirebase()!;
  const ref = doc(fb.db, COLLECTIONS.users, uid);
  const fallback = profileFromAuth(uid, email, displayName);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as UserDoc;
    await setDoc(
      ref,
      stripUndefined({
        ...fallback,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    return fallback;
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return fallback;
    }
    throw e;
  }
}

export async function signUpEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<ServiceResult<UserDoc | null>> {
  const fb = getFirebase();
  if (!fb) return mockResult({ ...MOCK_USER, email, displayName }, 'MOCK Auth — inscription locale');

  try {
    const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Account created — verification email may still be resent from Compte / Multi-IA
    }
    const profile = await ensureUserDoc(cred.user.uid, email, displayName);
    return liveResult(
      profile,
      'Compte créé — vérifie ton email (lien envoyé) avant le Multi-IA LIVE',
    );
  } catch (e) {
    return failResult(null, authErrorMessage(e));
  }
}

/** True when a Firebase user is signed in with a verified email (or mock/unconfigured). */
export async function isCurrentEmailVerified(): Promise<boolean> {
  if (!isFirebaseConfigured()) return true;
  const fb = getFirebase();
  const u = fb?.auth.currentUser;
  if (!u) return false;
  try {
    await u.reload();
    await u.getIdToken(true);
  } catch {
    // fall through to cached flag
  }
  return Boolean(fb?.auth.currentUser?.emailVerified);
}

/** Resend Firebase verification email to the signed-in user. */
export async function resendEmailVerification(): Promise<ServiceResult<{ sent: boolean }>> {
  const fb = getFirebase();
  if (!fb) {
    return mockResult({ sent: true }, 'MOCK Auth — email de vérification simulé');
  }
  const u = fb.auth.currentUser;
  if (!u) return failResult({ sent: false }, 'Connecte-toi d’abord (Module 15).');
  if (u.emailVerified) {
    return liveResult({ sent: false }, 'Email déjà vérifié');
  }
  try {
    await sendEmailVerification(u);
    return liveResult({ sent: true }, 'Email de vérification renvoyé — consulte ta boîte');
  } catch (e) {
    return failResult({ sent: false }, authErrorMessage(e));
  }
}

export async function signInEmail(
  email: string,
  password: string,
): Promise<ServiceResult<UserDoc | null>> {
  const fb = getFirebase();
  if (!fb) return mockResult({ ...MOCK_USER, email }, 'MOCK Auth — connexion locale');

  try {
    const cred = await signInWithEmailAndPassword(fb.auth, email, password);
    const profile = await ensureUserDoc(
      cred.user.uid,
      cred.user.email ?? email,
      cred.user.displayName,
    );
    return liveResult(profile);
  } catch (e) {
    return failResult(null, authErrorMessage(e));
  }
}

export async function signOutUser(): Promise<ServiceResult<null>> {
  const fb = getFirebase();
  // Clear medical PHI before auth uid disappears from getSignedInUid().
  const { clearMedicalLocalStore } = await import('../urgence/medicalLocalStore');
  const uid = fb?.auth.currentUser?.uid ?? null;
  await clearMedicalLocalStore(uid);
  if (!fb) return mockResult(null, 'MOCK Auth — déconnexion locale');
  try {
    await signOut(fb.auth);
    return liveResult(null);
  } catch (e) {
    return failResult(null, authErrorMessage(e));
  }
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  const fb = getFirebase();
  if (!fb) {
    cb(null);
    return () => undefined;
  }
  return onAuthStateChanged(fb.auth, cb);
}

export async function getCurrentUserProfile(): Promise<ServiceResult<UserDoc | null>> {
  if (!isFirebaseConfigured()) return mockResult(MOCK_USER, 'MOCK Auth — profil local');
  const fb = getFirebase()!;
  const u = fb.auth.currentUser;
  if (!u) return liveResult(null);
  try {
    const profile = await ensureUserDoc(u.uid, u.email ?? '', u.displayName);
    return liveResult(profile);
  } catch (e) {
    // Soft-fail: keep UI usable when rules deny users/{uid} (deploy pending).
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return mockResult(
        profileFromAuth(u.uid, u.email ?? '', u.displayName),
        'SOFT Auth — profil mémoire (Firestore permission / DEV)',
      );
    }
    return failResult(null, authErrorMessage(e));
  }
}

/**
 * Anonymous Auth for local/dev preview — no email approval gate.
 * Falls back to MOCK_USER when Firebase is off or soft-auth is forced.
 */
export async function signInAnonymousDev(): Promise<ServiceResult<UserDoc | null>> {
  if (!isFirebaseConfigured()) {
    return mockResult(MOCK_USER, 'MOCK Auth — anonyme local (Firebase off)');
  }
  const fb = getFirebase()!;
  try {
    const cred = await signInAnonymously(fb.auth);
    const profile = await ensureUserDoc(
      cred.user.uid,
      cred.user.email ?? 'anon@urgence-mecanique.local',
      cred.user.displayName ?? 'Anonyme DEV',
    );
    return liveResult(profile, 'Auth anonyme — session locale / preview');
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return mockResult(MOCK_USER, 'SOFT Auth — anonyme mock (permission / DEV)');
    }
    return failResult(null, authErrorMessage(e));
  }
}
