import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

  const refresh = async () => {
    try {
      const res = await getCurrentUserProfile();
      const enrollment = await loadRescuerEnrollment(res.data?.uid ?? null);
      setProfile(applyRescuerOverlay(res.data, enrollment));
    } catch {
      // Soft-fail: never leave Expo stuck / crash on Auth bootstrap errors.
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
