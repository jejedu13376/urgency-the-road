import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

/**
 * First-time register gate — blocks AppShell until the user creates/signs in
 * at least once on this device (AsyncStorage). Returning Auth sessions auto-unlock.
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
        // Wait for Auth bootstrap — existing session counts as registered.
        if (!authReady) return;
        if (profile?.email) {
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
  }, [authReady, profile?.email, profile?.displayName]);

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
