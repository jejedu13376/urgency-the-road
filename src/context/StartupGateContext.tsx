import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { verifyStartupPassword } from '../security/verifyStartupPassword';

type GateCtx = {
  unlocked: boolean;
  unlock: (password: string) => boolean;
  lock: () => void;
};

const Ctx = createContext<GateCtx | null>(null);

/**
 * Session-only unlock (React state). Cold start → locked again.
 * No AsyncStorage persistence by design (seller demo security).
 */
export function StartupGateProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);

  const unlock = useCallback((password: string) => {
    const ok = verifyStartupPassword(password);
    if (ok) setUnlocked(true);
    return ok;
  }, []);

  const lock = useCallback(() => setUnlocked(false), []);

  const value = useMemo(() => ({ unlocked, unlock, lock }), [unlocked, unlock, lock]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStartupGate() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStartupGate hors StartupGateProvider');
  return ctx;
}
