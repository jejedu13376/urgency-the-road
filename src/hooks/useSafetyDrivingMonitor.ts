/**
 * Global safety monitor: GPS motion → driving time, HOS live readout (CA/US/EU/AU),
 * 2h break TTS, truck-class overspeed, fatigue score + mandatory stop.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFleet } from '../context/FleetContext';
import { watchDevicePosition } from '../services/geo/deviceLocation';
import {
  accumulateDrivingTime,
  isDrivingBreakDue,
  loadDrivingBreakState,
  markDrivingBreakAlertSpoken,
  resetDrivingBreakAfterBreak,
  saveDrivingBreakState,
  speakDrivingBreakAlert,
  type DrivingBreakState,
} from '../services/urgence/drivingBreak';
import {
  computeFatigueScore,
  speakFatigueStopAlert,
  type FatigueScore,
} from '../services/urgence/fatigueScore';
import { computeHosLiveStatus, type HosLiveStatus } from '../services/urgence/hosLive';
import {
  resolveHosRegion,
  type HosRegionId,
} from '../services/urgence/hosRegs';
import {
  isOverSpeedLimit,
  resolveSpeedLimitFromProfile,
  speakOverspeedAlert,
  type SpeedLimitProfile,
} from '../services/urgence/truckSpeedLimit';

const OVERSPEED_COOLDOWN_MS = 45_000;
const FATIGUE_STOP_COOLDOWN_MS = 90_000;
const HOS_REGION_KEY = 'um.urgence.hosRegion.v1';
const HOS_SINCE_BREAK_KEY = 'um.urgence.sinceBreakSec.v1';

export type SafetyDrivingSnapshot = {
  breakState: DrivingBreakState;
  fatigue: FatigueScore;
  speedLimit: SpeedLimitProfile;
  speedKmh: number | null;
  overspeed: boolean;
  monitoring: boolean;
  hosRegion: HosRegionId;
  hosLive: HosLiveStatus;
  sinceBreakSec: number;
};

export function useSafetyDrivingMonitor() {
  const { active } = useFleet();
  const [breakState, setBreakState] = useState<DrivingBreakState>(() =>
    resetDrivingBreakAfterBreak(),
  );
  const [breaksTaken, setBreaksTaken] = useState(0);
  const [sinceBreakSec, setSinceBreakSec] = useState(0);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [overspeed, setOverspeed] = useState(false);
  const [monitoring, setMonitoring] = useState(true);
  const [ready, setReady] = useState(false);
  const [explicitHos, setExplicitHos] = useState<HosRegionId | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const lastTickRef = useRef<number | null>(null);
  const lastOverspeedSpeakRef = useRef(0);
  const lastFatigueSpeakRef = useRef(0);
  const breakStateRef = useRef(breakState);
  const breaksTakenRef = useRef(breaksTaken);
  const sinceBreakRef = useRef(sinceBreakSec);
  const speakingRef = useRef(false);

  breakStateRef.current = breakState;
  breaksTakenRef.current = breaksTaken;
  sinceBreakRef.current = sinceBreakSec;

  const hosRegion = useMemo(
    () =>
      resolveHosRegion({
        explicit: explicitHos,
        countryCode: active?.country,
        lat: coords?.lat,
        lon: coords?.lon,
        continent: active?.continent ?? null,
      }),
    [explicitHos, active?.country, active?.continent, coords?.lat, coords?.lon],
  );

  const speedLimit = resolveSpeedLimitFromProfile(active);
  const fatigue = computeFatigueScore({
    drivingSec: breakState.drivingSec,
    breaksTaken,
    sinceBreakSec,
    hosRegion,
  });

  const hosLive = useMemo(
    () =>
      computeHosLiveStatus({
        region: hosRegion,
        drivingSec: breakState.drivingSec,
        sinceBreakSec,
        now: new Date(nowTick),
      }),
    [hosRegion, breakState.drivingSec, sinceBreakSec, nowTick],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [s, regionRaw, sinceRaw] = await Promise.all([
        loadDrivingBreakState(),
        AsyncStorage.getItem(HOS_REGION_KEY),
        AsyncStorage.getItem(HOS_SINCE_BREAK_KEY),
      ]);
      if (cancelled) return;
      setBreakState(s);
      if (regionRaw === 'CA' || regionRaw === 'US' || regionRaw === 'EU' || regionRaw === 'AU') {
        setExplicitHos(regionRaw);
      }
      const since = sinceRaw != null ? Number(sinceRaw) : 0;
      if (Number.isFinite(since) && since >= 0) setSinceBreakSec(since);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh stop clock label once a minute while monitoring.
  useEffect(() => {
    if (!monitoring) return;
    const id = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [monitoring]);

  const setHosRegion = useCallback(async (region: HosRegionId) => {
    setExplicitHos(region);
    await AsyncStorage.setItem(HOS_REGION_KEY, region);
  }, []);

  const takeBreak = useCallback(async () => {
    const next = resetDrivingBreakAfterBreak();
    setBreakState(next);
    setBreaksTaken((n) => n + 1);
    setSinceBreakSec(0);
    sinceBreakRef.current = 0;
    await Promise.all([
      saveDrivingBreakState(next),
      AsyncStorage.setItem(HOS_SINCE_BREAK_KEY, '0'),
    ]);
  }, []);

  useEffect(() => {
    if (!monitoring || !ready) return;

    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    let appState: AppStateStatus =
      (AppState.currentState as AppStateStatus | null | undefined) ?? 'active';

    const onAppState = (next: string) => {
      appState = (next as AppStateStatus) || 'active';
      if (appState !== 'active') lastTickRef.current = null;
    };
    const appSub = AppState.addEventListener('change', onAppState);

    void (async () => {
      sub = await watchDevicePosition(async (pos) => {
        if (cancelled || appState !== 'active') return;
        const now = Date.now();
        setNowTick(now);
        setCoords({ lat: pos.lat, lon: pos.lon });
        const prev = lastTickRef.current;
        lastTickRef.current = now;
        const deltaSec = prev == null ? 0 : Math.min(5, Math.max(0, (now - prev) / 1000));

        const kmh =
          typeof pos.speedMps === 'number' && Number.isFinite(pos.speedMps)
            ? pos.speedMps * 3.6
            : null;
        setSpeedKmh(kmh);

        const limit = resolveSpeedLimitFromProfile(active);
        const over = isOverSpeedLimit({
          speedMps: pos.speedMps,
          limitKmh: limit.limitKmh,
        });
        setOverspeed(over);

        const beforeDrive = breakStateRef.current.drivingSec;
        const { state: next, crossedThreshold } = accumulateDrivingTime(breakStateRef.current, {
          deltaSec,
          speedMps: pos.speedMps,
          nowIso: new Date(now).toISOString(),
        });
        const credited = next.drivingSec > beforeDrive;
        breakStateRef.current = next;
        setBreakState(next);

        if (credited) {
          const since = sinceBreakRef.current + (next.drivingSec - beforeDrive);
          sinceBreakRef.current = since;
          setSinceBreakSec(since);
          void AsyncStorage.setItem(HOS_SINCE_BREAK_KEY, String(Math.floor(since)));
          void saveDrivingBreakState(next);
        }

        if (speakingRef.current) return;

        if (over && now - lastOverspeedSpeakRef.current > OVERSPEED_COOLDOWN_MS) {
          lastOverspeedSpeakRef.current = now;
          speakingRef.current = true;
          try {
            await speakOverspeedAlert({ limitKmh: limit.limitKmh });
          } finally {
            speakingRef.current = false;
          }
          return;
        }

        const region = resolveHosRegion({
          explicit: explicitHos,
          countryCode: active?.country,
          lat: pos.lat,
          lon: pos.lon,
          continent: active?.continent ?? null,
        });
        const fat = computeFatigueScore({
          drivingSec: next.drivingSec,
          breaksTaken: breaksTakenRef.current,
          sinceBreakSec: sinceBreakRef.current,
          hosRegion: region,
        });
        if (fat.mustStop && now - lastFatigueSpeakRef.current > FATIGUE_STOP_COOLDOWN_MS) {
          lastFatigueSpeakRef.current = now;
          speakingRef.current = true;
          try {
            await speakFatigueStopAlert();
          } finally {
            speakingRef.current = false;
          }
          return;
        }

        if (crossedThreshold || (isDrivingBreakDue(next) && !next.alertSpoken)) {
          speakingRef.current = true;
          try {
            await speakDrivingBreakAlert();
            const marked = await markDrivingBreakAlertSpoken(next);
            breakStateRef.current = marked;
            setBreakState(marked);
          } finally {
            speakingRef.current = false;
          }
        }
      });
    })();

    return () => {
      cancelled = true;
      appSub.remove();
      sub?.remove();
      lastTickRef.current = null;
    };
  }, [monitoring, ready, active, explicitHos]);

  const snapshot: SafetyDrivingSnapshot = {
    breakState,
    fatigue,
    speedLimit,
    speedKmh,
    overspeed,
    monitoring,
    hosRegion,
    hosLive,
    sinceBreakSec,
  };

  return {
    ...snapshot,
    ready,
    setMonitoring,
    takeBreak,
    setHosRegion,
  };
}
