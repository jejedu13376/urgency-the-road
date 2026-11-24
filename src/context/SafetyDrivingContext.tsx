import React, { createContext, useContext } from 'react';
import { useSafetyDrivingMonitor } from '../hooks/useSafetyDrivingMonitor';

type SafetyDrivingCtx = ReturnType<typeof useSafetyDrivingMonitor>;

const Ctx = createContext<SafetyDrivingCtx | null>(null);

export function SafetyDrivingProvider({ children }: { children: React.ReactNode }) {
  const value = useSafetyDrivingMonitor();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSafetyDriving(): SafetyDrivingCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useSafetyDriving must be used within SafetyDrivingProvider');
  }
  return ctx;
}
