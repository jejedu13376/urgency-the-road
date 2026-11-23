import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MOCK_FLEET } from '../data/mocks';
import type { VehicleProfile } from '../types/vehicle';

const STORAGE_KEY = 'um.fleet.v1';

type FleetCtx = {
  vehicles: VehicleProfile[];
  activeId: string | null;
  active: VehicleProfile | null;
  ready: boolean;
  setActive: (id: string) => void;
  upsertVehicle: (v: VehicleProfile) => void;
  removeVehicle: (id: string) => void;
};

const Ctx = createContext<FleetCtx | null>(null);

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<VehicleProfile[]>(MOCK_FLEET);
  const [activeId, setActiveId] = useState<string | null>(MOCK_FLEET[0]?.id ?? null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { vehicles: VehicleProfile[]; activeId: string | null };
          if (parsed.vehicles?.length) {
            setVehicles(parsed.vehicles);
            setActiveId(parsed.activeId ?? parsed.vehicles[0].id);
          }
        }
      } catch {
        /* keep mocks */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ vehicles, activeId }));
  }, [vehicles, activeId, ready]);

  const setActive = useCallback((id: string) => setActiveId(id), []);
  const upsertVehicle = useCallback((v: VehicleProfile) => {
    setVehicles((prev) => {
      const i = prev.findIndex((x) => x.id === v.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = v;
        return next;
      }
      return [...prev, v];
    });
    setActiveId(v.id);
  }, []);
  const removeVehicle = useCallback((id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const active = useMemo(
    () => vehicles.find((v) => v.id === activeId) ?? vehicles[0] ?? null,
    [vehicles, activeId],
  );

  const value = useMemo(
    () => ({ vehicles, activeId: active?.id ?? null, active, ready, setActive, upsertVehicle, removeVehicle }),
    [vehicles, active, ready, setActive, upsertVehicle, removeVehicle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFleet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFleet hors FleetProvider');
  return ctx;
}
