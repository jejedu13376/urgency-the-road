import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUserProfile, watchAuth } from '../services/firebase/authService';
import {
  applyRescuerOverlay,
  loadRescuerEnrollment,
} from '../services/urgence/rescuerEnrollment';
import type { UserDoc } from '../types/firestore';

type AuthCtx = {
  profile: UserDoc | null;
  ready: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [ready, setReady] = useState(false);
  /** Drops stale enrollment loads after sign-out / account switch. */
  const refreshGen = useRef(0);

  const refresh = async () => {
    const gen = ++refreshGen.current;
    try {
      const res = await getCurrentUserProfile();
      const uid = res.data?.uid;
      const enrollment = uid ? await loadRescuerEnrollment(uid) : null;
      if (gen !== refreshGen.current) return;
      if (enrollment && uid && enrollment.uid !== uid) {
        setProfile(res.data);
        return;
      }
      setProfile(applyRescuerOverlay(res.data, enrollment));
    } catch {
      // Soft-fail: never leave Expo stuck / crash on Auth bootstrap errors.
      if (gen !== refreshGen.current) return;
      setProfile(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = () => {
      void refresh().finally(() => {
        if (!cancelled) setReady(true);
      });
    };
    const unsub = watchAuth(() => {
      boot();
    });
    const t = setTimeout(boot, 0);
    return () => {
      cancelled = true;
      refreshGen.current += 1;
      clearTimeout(t);
      unsub();
    };
  }, []);

  const value = useMemo(() => ({ profile, ready, refresh }), [profile, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
