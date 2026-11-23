import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
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

/**
 * Returns Firebase clients or null when config is missing.
 * Callers MUST fall back to mock services when null.
 */
export function getFirebase(): FirebaseClients | null {
  if (!isFirebaseConfigured()) return null;
  if (cached) return cached;
  const config = readConfig();
  const app = getApps().length ? getApp() : initializeApp(config);
  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}

export function firebaseStatusLabel(): string {
  return isFirebaseConfigured()
    ? 'Firebase configuré'
    : 'MOCK — Firebase non configuré (EXPO_PUBLIC_* manquants)';
}
