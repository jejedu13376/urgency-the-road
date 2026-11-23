import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUserProfile, watchAuth } from '../services/firebase/authService';
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
    const res = await getCurrentUserProfile();
    setProfile(res.data);
  };

  useEffect(() => {
    const unsub = watchAuth(() => {
      void refresh().finally(() => setReady(true));
    });
    void refresh().finally(() => setReady(true));
    return unsub;
  }, []);

  const value = useMemo(() => ({ profile, ready, refresh }), [profile, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
