import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getFirebase, isFirebaseConfigured } from '../firebase/config';
import { useAuth } from './AuthContext';
import {
  isRegisterCompleted,
  markRegisterCompleted,
  saveLocalUserProfile,
} from '../services/prefs/userProfileLocal';

type RegisterGateCtx = {
  ready: boolean;
  registered: boolean;
  completeRegistration: (opts?: { email?: string; displayName?: string }) => Promise<void>;
};

const Ctx = createContext<RegisterGateCtx | null>(null);

/** Live Firebase Auth only — never the static MOCK_USER from unconfigured Firebase. */
function hasLiveAuthSession(uid?: string | null): boolean {
  if (!isFirebaseConfigured() || !uid || uid === 'mock-local-user') return false;
  return Boolean(getFirebase()?.auth.currentUser);
}

/**
 * First-time register gate — blocks AppShell until the user creates/signs in
 * at least once on this device (AsyncStorage). Returning live Auth sessions auto-unlock.
 * Mock Auth (Firebase off) must go through RegisterGateScreen → completeRegistration.
 */
export function RegisterGateProvider({ children }: { children: React.ReactNode }) {
  const { profile, ready: authReady } = useAuth();
  const [ready, setReady] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const done = await isRegisterCompleted();
        if (cancelled) return;
        if (done) {
          setRegistered(true);
          setReady(true);
          return;
        }
        // Wait for Auth bootstrap — live Firebase session only (not MOCK_USER).
        if (!authReady) return;
        if (hasLiveAuthSession(profile?.uid) && profile?.email) {
          await markRegisterCompleted();
          await saveLocalUserProfile({
            email: profile.email,
            displayName: profile.displayName ?? '',
          });
          if (!cancelled) {
            setRegistered(true);
            setReady(true);
          }
          return;
        }
        if (!cancelled) {
          setRegistered(false);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setRegistered(false);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, profile?.uid, profile?.email, profile?.displayName]);

  const completeRegistration = useCallback(
    async (opts?: { email?: string; displayName?: string }) => {
      if (opts?.email || opts?.displayName) {
        await saveLocalUserProfile({
          email: opts.email ?? '',
          displayName: opts.displayName ?? '',
        });
      }
      await markRegisterCompleted();
      setRegistered(true);
    },
    [],
  );

  const value = useMemo(
    () => ({ ready, registered, completeRegistration }),
    [ready, registered, completeRegistration],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRegisterGate() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRegisterGate hors RegisterGateProvider');
  return ctx;
}
