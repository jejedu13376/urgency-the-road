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
import { liveResult, mockResult, ServiceResult } from './result';

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

export async function signUpEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<ServiceResult<UserDoc>> {
  const fb = getFirebase();
  if (!fb) return mockResult({ ...MOCK_USER, email, displayName }, 'MOCK Auth — inscription locale');

  const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  const profile: UserDoc = {
    uid: cred.user.uid,
    email,
    displayName,
    role: 'user',
    subscription: 'free',
    subscriptionActive: false,
    locale: 'fr',
    currency: 'EUR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(fb.db, COLLECTIONS.users, cred.user.uid), {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return liveResult(profile);
}

export async function signInEmail(email: string, password: string): Promise<ServiceResult<UserDoc>> {
  const fb = getFirebase();
  if (!fb) return mockResult({ ...MOCK_USER, email }, 'MOCK Auth — connexion locale');

  const cred = await signInWithEmailAndPassword(fb.auth, email, password);
  const snap = await getDoc(doc(fb.db, COLLECTIONS.users, cred.user.uid));
  if (snap.exists()) return liveResult(snap.data() as UserDoc);
  const profile: UserDoc = {
    ...MOCK_USER,
    uid: cred.user.uid,
    email: cred.user.email ?? email,
    displayName: cred.user.displayName ?? undefined,
  };
  return liveResult(profile);
}

export async function signOutUser(): Promise<ServiceResult<null>> {
  const fb = getFirebase();
  if (!fb) return mockResult(null, 'MOCK Auth — déconnexion locale');
  await signOut(fb.auth);
  return liveResult(null);
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
  const snap = await getDoc(doc(fb.db, COLLECTIONS.users, u.uid));
  return liveResult(snap.exists() ? (snap.data() as UserDoc) : null);
}
