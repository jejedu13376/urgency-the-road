import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  loadNightModeSetting,
  nightPalette,
  resolveNightActive,
  saveNightModeSetting,
  type NightModeSetting,
} from '../services/urgence/nightMode';

type NightCtx = {
  setting: NightModeSetting;
  active: boolean;
  setSetting: (s: NightModeSetting) => void;
};

const Ctx = createContext<NightCtx | null>(null);

export function NightModeProvider({ children }: { children: React.ReactNode }) {
  const [setting, setSettingState] = useState<NightModeSetting>('auto');
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    void loadNightModeSetting().then(setSettingState);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  const setSetting = useCallback((s: NightModeSetting) => {
    setSettingState(s);
    void saveNightModeSetting(s);
  }, []);

  const active = resolveNightActive({ setting, hour });

  const value = useMemo(
    () => ({ setting, active, setSetting }),
    [setting, active, setSetting],
  );

  return (
    <Ctx.Provider value={value}>
      <View style={[styles.root, active && styles.rootNight]}>{children}</View>
      {active ? <View pointerEvents="none" style={styles.dim} /> : null}
    </Ctx.Provider>
  );
}

export function useNightMode(): NightCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNightMode must be used within NightModeProvider');
  return ctx;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootNight: { backgroundColor: nightPalette.paper },
  dim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: nightPalette.dimOverlay,
    zIndex: 90,
    elevation: 90,
  },
});
