import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { MOCK_FLEET } from '../data/mocks';
import {
  listVehicles,
  removeVehicle as removeVehicleRemote,
  upsertVehicle as upsertVehicleRemote,
} from '../services/firebase/vehiclesService';
import type { VehicleProfile } from '../types/vehicle';

const STORAGE_KEY = 'um.fleet.v1';
const MOCK_IDS = new Set(MOCK_FLEET.map((v) => v.id));

type FleetCtx = {
  vehicles: VehicleProfile[];
  activeId: string | null;
  active: VehicleProfile | null;
  ready: boolean;
  /** Local AsyncStorage, or Firestore when Auth + Firebase. */
  syncSource: 'local' | 'firestore' | 'pending';
  syncLabel?: string;
  setActive: (id: string) => void;
  upsertVehicle: (v: VehicleProfile) => void;
  removeVehicle: (id: string) => void;
  /** Force pull from Firestore when signed in. */
  refreshCloud: () => Promise<void>;
};

const Ctx = createContext<FleetCtx | null>(null);

/** Cascade / decoded / custom ids — never push untouched MOCK_FLEET seeds alone. */
function isMigratable(v: VehicleProfile): boolean {
  if (v.id.startsWith('cascade-') || v.id.startsWith('decoded-')) return true;
  if (!MOCK_IDS.has(v.id)) return true;
  return false;
}

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const { profile, ready: authReady } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleProfile[]>(MOCK_FLEET);
  const [activeId, setActiveId] = useState<string | null>(MOCK_FLEET[0]?.id ?? null);
  const [ready, setReady] = useState(false);
  const [syncSource, setSyncSource] = useState<'local' | 'firestore' | 'pending'>('pending');
  const [syncLabel, setSyncLabel] = useState<string | undefined>();
  const localLoaded = useRef(false);
  const vehiclesRef = useRef(vehicles);
  const activeIdRef = useRef(activeId);
  vehiclesRef.current = vehicles;
  activeIdRef.current = activeId;

  // Load AsyncStorage once
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
        localLoaded.current = true;
        setReady(true);
        setSyncSource('local');
        setSyncLabel('Flotte locale AsyncStorage');
      }
    })();
  }, []);

  // Persist locally always (cache / offline)
  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ vehicles, activeId }));
  }, [vehicles, activeId, ready]);

  const pushLocalToCloud = useCallback(async (list: VehicleProfile[], uid: string) => {
    const mapped: VehicleProfile[] = [];
    for (const v of list) {
      const res = await upsertVehicleRemote(uid, v);
      if (res.data) mapped.push(res.data);
    }
    return mapped.length ? mapped : list;
  }, []);

  const refreshCloud = useCallback(async () => {
    if (!authReady || !profile?.uid) {
      setSyncSource('local');
      setSyncLabel('Flotte locale — connectez-vous pour sync cloud');
      return;
    }
    setSyncSource('pending');
    try {
      const res = await listVehicles(profile.uid);
      if (res.source === 'firebase' && res.data.length > 0) {
        setVehicles(res.data);
        setActiveId((cur) => {
          if (cur && res.data.some((v) => v.id === cur)) return cur;
          return res.data[0]?.id ?? null;
        });
        setSyncSource('firestore');
        setSyncLabel(res.stubLabel ?? `Flotte Firestore LIVE (${res.data.length})`);
        return;
      }
      // Remote empty — migrate only user-created local vehicles (not seed mocks)
      const local = vehiclesRef.current;
      const custom = local.filter(isMigratable);
      if (custom.length) {
        const uploaded = await pushLocalToCloud(custom, profile.uid);
        setVehicles(uploaded);
        setActiveId((cur) => {
          if (cur && uploaded.some((v) => v.id === cur)) return cur;
          return uploaded[0]?.id ?? null;
        });
        setSyncSource('firestore');
        setSyncLabel(`Flotte migrée locale→Firestore (${uploaded.length})`);
        return;
      }
      setSyncSource(res.source === 'firebase' ? 'firestore' : 'local');
      setSyncLabel(
        res.stubLabel ??
          (res.source === 'firebase'
            ? 'Flotte Firestore vide — ajoutez via cascade / VIN'
            : 'Flotte locale (cloud indisponible)'),
      );
    } catch (e) {
      setSyncSource('local');
      setSyncLabel(e instanceof Error ? `Cloud KO — ${e.message}` : 'Cloud KO — flotte locale');
    }
  }, [authReady, profile?.uid, pushLocalToCloud]);

  useEffect(() => {
    if (!ready || !localLoaded.current || !authReady) return;
    void refreshCloud();
  }, [ready, authReady, profile?.uid, refreshCloud]);

  const setActive = useCallback((id: string) => setActiveId(id), []);

  const upsertVehicle = useCallback(
    (v: VehicleProfile) => {
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

      const uid = profile?.uid;
      if (!uid) {
        setSyncSource('local');
        setSyncLabel('Flotte locale — Auth pour sync Firestore');
        return;
      }
      void upsertVehicleRemote(uid, v).then((res) => {
        if (res.source === 'firebase' && res.data && res.data.id !== v.id) {
          // Firestore assigned a new id (cascade-/decoded- → addDoc)
          setVehicles((prev) => prev.map((x) => (x.id === v.id ? { ...res.data!, id: res.data!.id } : x)));
          setActiveId(res.data.id);
        }
        if (res.source === 'firebase') {
          setSyncSource('firestore');
          setSyncLabel(res.stubLabel ?? 'Flotte Firestore LIVE');
        } else {
          setSyncLabel(res.stubLabel ?? 'Upsert local (cloud mock)');
        }
      });
    },
    [profile?.uid],
  );

  const removeVehicle = useCallback(
    (id: string) => {
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
      if (profile?.uid) {
        void removeVehicleRemote(id).then((res) => {
          if (res.source === 'firebase') {
            setSyncSource('firestore');
            setSyncLabel('Véhicule retiré Firestore');
          }
        });
      }
    },
    [profile?.uid],
  );

  const active = useMemo(
    () => vehicles.find((v) => v.id === activeId) ?? vehicles[0] ?? null,
    [vehicles, activeId],
  );

  const value = useMemo(
    () => ({
      vehicles,
      activeId: active?.id ?? null,
      active,
      ready,
      syncSource,
      syncLabel,
      setActive,
      upsertVehicle,
      removeVehicle,
      refreshCloud,
    }),
    [
      vehicles,
      active,
      ready,
      syncSource,
      syncLabel,
      setActive,
      upsertVehicle,
      removeVehicle,
      refreshCloud,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFleet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFleet hors FleetProvider');
  return ctx;
}
