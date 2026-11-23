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

/** Legacy unscoped key — read once then abandoned (never write back). */
const LEGACY_STORAGE_KEY = 'um.fleet.v1';
const MOCK_IDS = new Set(MOCK_FLEET.map((v) => v.id));

function storageKeyFor(uid: string | null | undefined): string {
  return uid ? `um.fleet.v1:uid:${uid}` : 'um.fleet.v1:local';
}

type FleetCtx = {
  vehicles: VehicleProfile[];
  activeId: string | null;
  active: VehicleProfile | null;
  ready: boolean;
  /** Local AsyncStorage, or Firestore when Auth + Firebase. */
  syncSource: 'local' | 'firestore' | 'pending';
  syncLabel?: string;
  /** Migratable local rows waiting for explicit upload (never auto). */
  pendingLocalMigrateCount: number;
  setActive: (id: string) => void;
  upsertVehicle: (v: VehicleProfile) => void;
  removeVehicle: (id: string) => void;
  /** Pull from Firestore only — never auto-uploads another account’s local cache. */
  refreshCloud: () => Promise<void>;
  /** Explicit user action: upload current account’s local custom vehicles to Firestore. */
  migrateLocalToCloud: () => Promise<void>;
};

const Ctx = createContext<FleetCtx | null>(null);

/** Cascade / decoded / custom ids — never push untouched MOCK_FLEET seeds alone. */
function isMigratable(v: VehicleProfile): boolean {
  if (v.id.startsWith('cascade-') || v.id.startsWith('decoded-') || v.id.startsWith('nhtsa-')) {
    return true;
  }
  if (!MOCK_IDS.has(v.id)) return true;
  return false;
}

function resetToMocks(): { vehicles: VehicleProfile[]; activeId: string | null } {
  return {
    vehicles: MOCK_FLEET,
    activeId: MOCK_FLEET[0]?.id ?? null,
  };
}

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const { profile, ready: authReady } = useAuth();
  const uid = profile?.uid ?? null;
  const [vehicles, setVehicles] = useState<VehicleProfile[]>(MOCK_FLEET);
  const [activeId, setActiveId] = useState<string | null>(MOCK_FLEET[0]?.id ?? null);
  const [ready, setReady] = useState(false);
  const [syncSource, setSyncSource] = useState<'local' | 'firestore' | 'pending'>('pending');
  const [syncLabel, setSyncLabel] = useState<string | undefined>();
  const [bucketReady, setBucketReady] = useState(false);
  const vehiclesRef = useRef(vehicles);
  const prevUidRef = useRef<string | null | undefined>(undefined);
  vehiclesRef.current = vehicles;

  const pendingLocalMigrateCount = useMemo(
    () => vehicles.filter(isMigratable).length,
    [vehicles],
  );

  // Load / switch AsyncStorage bucket when auth identity changes
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    (async () => {
      setBucketReady(false);
      setReady(false);

      const prev = prevUidRef.current;
      // Sign-out or account switch: drop in-memory fleet so we never show/write another user’s cars
      if (prev !== undefined && prev !== uid) {
        const mocks = resetToMocks();
        setVehicles(mocks.vehicles);
        setActiveId(mocks.activeId);
        setSyncSource('local');
        setSyncLabel(
          uid
            ? 'Compte changé — flotte rechargée pour cet uid'
            : 'Déconnexion — flotte locale réinitialisée (pas de fuite inter-comptes)',
        );
      }
      prevUidRef.current = uid;

      const key = storageKeyFor(uid);
      try {
        let raw = await AsyncStorage.getItem(key);
        // One-shot: unsigned bucket may absorb legacy unscoped cache (never into a uid bucket)
        if (!raw && !uid) {
          const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            raw = legacy;
            await AsyncStorage.setItem(key, legacy);
            await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        }
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as { vehicles: VehicleProfile[]; activeId: string | null };
          if (parsed.vehicles?.length) {
            setVehicles(parsed.vehicles);
            setActiveId(parsed.activeId ?? parsed.vehicles[0].id);
          }
        } else if (!cancelled && uid) {
          // Signed-in with empty uid cache — start from mocks until Firestore pull
          const mocks = resetToMocks();
          setVehicles(mocks.vehicles);
          setActiveId(mocks.activeId);
        }
      } catch {
        /* keep current / mocks */
      } finally {
        if (!cancelled) {
          setBucketReady(true);
          setReady(true);
          if (!uid) {
            setSyncSource('local');
            setSyncLabel((cur) => cur ?? 'Flotte locale AsyncStorage (um.fleet.v1:local)');
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, uid]);

  // Persist only into the active identity bucket
  useEffect(() => {
    if (!ready || !bucketReady || !authReady) return;
    const key = storageKeyFor(uid);
    void AsyncStorage.setItem(key, JSON.stringify({ vehicles, activeId }));
  }, [vehicles, activeId, ready, bucketReady, authReady, uid]);

  /** Apply oldId → remote vehicle remaps into local fleet (keeps non-remapped rows). */
  const applyIdRemaps = useCallback((byOldId: Map<string, VehicleProfile>) => {
    if (!byOldId.size) return;
    setVehicles((prev) => prev.map((v) => byOldId.get(v.id) ?? v));
    setActiveId((cur) => (cur && byOldId.has(cur) ? byOldId.get(cur)!.id : cur));
  }, []);

  /**
   * Upload every migratable vehicle. Remaps successful rows immediately (old local id →
   * Firestore id) so a mid-loop failure cannot leave cascade-/decoded- ids that would
   * addDoc again on retry. Returns remaps + optional failure message.
   */
  const pushLocalToCloud = useCallback(
    async (
      list: VehicleProfile[],
      ownerUid: string,
    ): Promise<{ remapped: Map<string, VehicleProfile>; failed?: string }> => {
      const remapped = new Map<string, VehicleProfile>();
      for (const v of list) {
        const res = await upsertVehicleRemote(ownerUid, v);
        if (res.ok === false || !res.data) {
          // Successes already remapped below — keep them; do not re-addDoc on retry.
          return {
            remapped,
            failed: res.stubLabel ?? 'Migration cloud refusée',
          };
        }
        remapped.set(v.id, res.data);
        // Remap immediately after each success (crash-safe mid-migrate).
        applyIdRemaps(new Map([[v.id, res.data]]));
      }
      return { remapped };
    },
    [applyIdRemaps],
  );

  /** Pull only — never auto-migrate local → other uid. */
  const refreshCloud = useCallback(async () => {
    if (!authReady || !uid) {
      setSyncSource('local');
      setSyncLabel('Flotte locale — connectez-vous pour sync cloud');
      return;
    }
    setSyncSource('pending');
    try {
      const res = await listVehicles(uid);
      if (res.ok === false) {
        // Keep current local fleet — do not replace with mock / empty “live” data.
        setSyncSource('local');
        setSyncLabel(res.stubLabel ?? 'Cloud KO — flotte locale conservée');
        return;
      }
      if (res.source === 'firebase' && res.data.length > 0) {
        // Merge: keep pending local-temp migratables not yet on cloud (avoid wipe after partial migrate).
        const cloud = res.data;
        const cloudIds = new Set(cloud.map((v) => v.id));
        const cloudVins = new Set(
          cloud.map((v) => (v.vin ?? '').trim().toUpperCase()).filter((vin) => vin.length >= 8),
        );
        const pendingLocal = vehiclesRef.current.filter((v) => {
          if (!isMigratable(v)) return false;
          const localTemp =
            v.id.startsWith('cascade-') ||
            v.id.startsWith('decoded-') ||
            v.id.startsWith('nhtsa-');
          if (!localTemp) return false;
          if (cloudIds.has(v.id)) return false;
          const vin = (v.vin ?? '').trim().toUpperCase();
          // VIN present: drop only when that exact VIN is already on cloud.
          if (vin.length >= 8) return !cloudVins.has(vin);
          // No VIN: never fingerprint-drop — identical cascade twins stay until remapped by clientLocalId.
          return true;
        });
        const merged = [...cloud, ...pendingLocal];
        setVehicles(merged);
        setActiveId((cur) => {
          if (cur && merged.some((v) => v.id === cur)) return cur;
          return merged[0]?.id ?? null;
        });
        setSyncSource('firestore');
        setSyncLabel(
          pendingLocal.length
            ? `Flotte Firestore LIVE (${cloud.length}) + ${pendingLocal.length} local(aux) en attente`
            : res.stubLabel ?? `Flotte Firestore LIVE (${cloud.length})`,
        );
        return;
      }
      const custom = vehiclesRef.current.filter(isMigratable);
      setSyncSource(res.source === 'firebase' ? 'firestore' : 'local');
      setSyncLabel(
        custom.length
          ? `Flotte cloud vide — ${custom.length} véhicule(s) locaux prêts (bouton Migrer explicite)`
          : res.stubLabel ??
              (res.source === 'firebase'
                ? 'Flotte Firestore vide — ajoutez via cascade / VIN'
                : 'Flotte locale (cloud indisponible)'),
      );
    } catch (e) {
      setSyncSource('local');
      setSyncLabel(e instanceof Error ? `Cloud KO — ${e.message}` : 'Cloud KO — flotte locale');
    }
  }, [authReady, uid]);

  /** Explicit migrate — only current uid’s bucket contents. */
  const migrateLocalToCloud = useCallback(async () => {
    if (!authReady || !uid) {
      setSyncLabel('Connexion requise pour migrer la flotte');
      return;
    }
    const custom = vehiclesRef.current.filter(isMigratable);
    if (!custom.length) {
      setSyncLabel('Rien à migrer (pas de véhicule cascade/VIN local)');
      return;
    }
    setSyncSource('pending');
    const { remapped, failed } = await pushLocalToCloud(custom, uid);
    if (failed) {
      setSyncSource('local');
      setSyncLabel(
        remapped.size
          ? `Migration partielle — ${remapped.size} syncé(s), échec: ${failed}`
          : `Migration KO — ${failed}`,
      );
      return;
    }
    setSyncSource('firestore');
    setSyncLabel(`Migration explicite OK — ${remapped.size} véhicule(s) → Firestore (uid courant)`);
  }, [authReady, uid, pushLocalToCloud]);

  useEffect(() => {
    if (!ready || !bucketReady || !authReady) return;
    if (!uid) return;
    void refreshCloud();
  }, [ready, bucketReady, authReady, uid, refreshCloud]);

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

      if (!uid) {
        setSyncSource('local');
        setSyncLabel('Flotte locale — Auth pour sync Firestore');
        return;
      }
      // Live upsert only for the signed-in uid (current session action)
      void upsertVehicleRemote(uid, v).then((res) => {
        if (res.ok === false) {
          setSyncLabel(res.stubLabel ?? 'Upsert cloud refusé — flotte locale');
          return;
        }
        if (res.source === 'firebase' && res.data && res.data.id !== v.id) {
          setVehicles((prev) =>
            prev.map((x) => (x.id === v.id ? { ...res.data!, id: res.data!.id } : x)),
          );
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
    [uid],
  );

  const removeVehicle = useCallback(
    (id: string) => {
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
      if (uid) {
        void removeVehicleRemote(id).then((res) => {
          if (res.ok === false) {
            setSyncLabel(res.stubLabel ?? 'Suppression cloud refusée');
            return;
          }
          if (res.source === 'firebase') {
            setSyncSource('firestore');
            setSyncLabel('Véhicule retiré Firestore');
          }
        });
      }
    },
    [uid],
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
      pendingLocalMigrateCount,
      setActive,
      upsertVehicle,
      removeVehicle,
      refreshCloud,
      migrateLocalToCloud,
    }),
    [
      vehicles,
      active,
      ready,
      syncSource,
      syncLabel,
      pendingLocalMigrateCount,
      setActive,
      upsertVehicle,
      removeVehicle,
      refreshCloud,
      migrateLocalToCloud,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFleet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFleet hors FleetProvider');
  return ctx;
}
