import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ModuleId } from '../types/modules';

const KEY = 'um.progress.v1';

type ProgressState = {
  visited: ModuleId[];
  streakDays: number;
  lastOpenDate: string | null;
  lastBonusDate: string | null;
  xp: number;
  badges: string[];
};

type ProgressCtx = ProgressState & {
  ready: boolean;
  markVisited: (id: ModuleId) => void;
  completionPct: number;
  todayBonusClaimed: boolean;
  claimDailyBonus: () => number;
};

const defaultState: ProgressState = {
  visited: [],
  streakDays: 0,
  lastOpenDate: null,
  lastBonusDate: null,
  xp: 0,
  badges: [],
};

const Ctx = createContext<ProgressCtx | null>(null);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>(defaultState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? (JSON.parse(raw) as ProgressState) : defaultState;
        const today = todayIso();
        let next: ProgressState = { ...defaultState, ...parsed };
        if (next.lastOpenDate === yesterdayIso()) {
          next = { ...next, streakDays: Math.max(1, next.streakDays) + 1, lastOpenDate: today };
        } else if (next.lastOpenDate !== today) {
          next = { ...next, streakDays: 1, lastOpenDate: today };
        }
        setState(next);
      } catch {
        setState({ ...defaultState, streakDays: 1, lastOpenDate: todayIso() });
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(KEY, JSON.stringify(state));
  }, [state, ready]);

  const markVisited = useCallback((id: ModuleId) => {
    setState((prev) => {
      if (prev.visited.includes(id)) return prev;
      const visited = [...prev.visited, id];
      const badges = [...prev.badges];
      if (visited.length === 1 && !badges.includes('premier_pas')) badges.push('premier_pas');
      if (visited.length >= 5 && !badges.includes('explorateur')) badges.push('explorateur');
      if (visited.length >= 10 && !badges.includes('mecano_confirme')) badges.push('mecano_confirme');
      if (visited.length >= 17 && !badges.includes('maitre_17')) badges.push('maitre_17');
      return { ...prev, visited, xp: prev.xp + 25, badges };
    });
  }, []);

  const todayBonusClaimed = state.lastBonusDate === todayIso();

  const claimDailyBonus = useCallback(() => {
    if (state.lastBonusDate === todayIso()) return 0;
    const bonus = 10 + Math.min(Math.max(state.streakDays, 1), 14) * 2;
    setState((prev) => ({
      ...prev,
      xp: prev.xp + bonus,
      lastBonusDate: todayIso(),
      lastOpenDate: todayIso(),
    }));
    return bonus;
  }, [state.lastBonusDate, state.streakDays]);

  const completionPct = Math.round((state.visited.length / 17) * 100);

  const value = useMemo(
    () => ({ ...state, ready, markVisited, completionPct, todayBonusClaimed, claimDailyBonus }),
    [state, ready, markVisited, completionPct, todayBonusClaimed, claimDailyBonus],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProgress() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProgress hors ProgressProvider');
  return ctx;
}
