import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase, isFirebaseConfigured } from '../../firebase/config';
import type { UserDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
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

/** Ensure users/{uid} exists so refresh() does not wipe a successful sign-in. */
async function ensureUserDoc(
  uid: string,
  email: string,
  displayName?: string | null,
): Promise<UserDoc> {
  const fb = getFirebase()!;
  const ref = doc(fb.db, COLLECTIONS.users, uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserDoc;
  const profile = profileFromAuth(uid, email, displayName);
  await setDoc(
    ref,
    stripUndefined({
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  return profile;
}

export async function signUpEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<ServiceResult<UserDoc>> {
  const fb = getFirebase();
  if (!fb) return mockResult({ ...MOCK_USER, email, displayName }, 'MOCK Auth — inscription locale');

  try {
    const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    const profile = await ensureUserDoc(cred.user.uid, email, displayName);
    return liveResult(profile);
  } catch (e) {
    return failResult(MOCK_USER, authErrorMessage(e));
  }
}

export async function signInEmail(email: string, password: string): Promise<ServiceResult<UserDoc>> {
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
    return failResult(MOCK_USER, authErrorMessage(e));
  }
}

export async function signOutUser(): Promise<ServiceResult<null>> {
  const fb = getFirebase();
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
    return failResult(null, authErrorMessage(e));
  }
}
