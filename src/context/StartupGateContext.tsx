import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { STARTUP_GATE_ENABLED } from '../security/startupGateConfig';
import { verifyStartupPassword } from '../security/verifyStartupPassword';

type GateCtx = {
  unlocked: boolean;
  gateEnabled: boolean;
  unlock: (password: string) => boolean;
  lock: () => void;
};

const Ctx = createContext<GateCtx | null>(null);

/**
 * Session-only unlock (React state). Cold start → locked again when gate enabled.
 * No AsyncStorage persistence by design (seller demo friction).
 * When EXPO_PUBLIC_APP_GATE_PASSWORD is unset → unlocked immediately.
 */
export function StartupGateProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(!STARTUP_GATE_ENABLED);

  const unlock = useCallback((password: string) => {
    const ok = verifyStartupPassword(password);
    if (ok) setUnlocked(true);
    return ok;
  }, []);

  const lock = useCallback(() => {
    if (STARTUP_GATE_ENABLED) setUnlocked(false);
  }, []);

  const value = useMemo(
    () => ({ unlocked, gateEnabled: STARTUP_GATE_ENABLED, unlock, lock }),
    [unlocked, unlock, lock],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStartupGate() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStartupGate hors StartupGateProvider');
  return ctx;
}
