import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

export type FirebaseClients = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

function readConfig() {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
  };
}

/** True when enough EXPO_PUBLIC_* Firebase keys are present to init the SDK. */
export function isFirebaseConfigured(): boolean {
  const c = readConfig();
  return Boolean(c.apiKey && c.projectId && c.appId && c.authDomain);
}

let cached: FirebaseClients | null = null;

function initAuth(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already initialized (Fast Refresh) or persistence unavailable in this runtime
    return getAuth(app);
  }
}

/**
 * Returns Firebase clients or null when config is missing.
 * Callers MUST fall back to mock services when null.
 * Auth uses AsyncStorage persistence so Module 15 sessions survive restarts.
 */
export function getFirebase(): FirebaseClients | null {
  if (!isFirebaseConfigured()) return null;
  if (cached) return cached;
  const config = readConfig();
  const app = getApps().length ? getApp() : initializeApp(config);
  cached = { app, auth: initAuth(app), db: getFirestore(app) };
  return cached;
}

/** Signed-in uid when Firebase is live; null when unsigned or unconfigured. */
export function getSignedInUid(): string | null {
  const fb = getFirebase();
  return fb?.auth.currentUser?.uid ?? null;
}

/**
 * Prefer Auth uid; if Firebase is configured but the user is signed out,
 * return null so callers stay on mock instead of hitting denied rules.
 */
export function resolveOwnerUid(preferred?: string | null): string | null {
  const live = getSignedInUid();
  if (live) return live;
  if (getFirebase()) return null;
  return preferred && preferred !== 'mock-local-user' ? preferred : 'mock-local-user';
}

export function firebaseStatusLabel(): string {
  return isFirebaseConfigured()
    ? 'Firebase configuré'
    : 'MOCK — Firebase non configuré (EXPO_PUBLIC_* manquants)';
}
