import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import {
  APP_LOCALES,
  loadStoredLocale,
  resolveDeviceLocale,
  saveStoredLocale,
  setI18nLocale,
  t as translate,
  type AppLocale,
  type TranslateOptions,
} from '../i18n';
import { colors } from '../theme/colors';

type I18nContextValue = {
  locale: AppLocale;
  ready: boolean;
  setLocale: (locale: AppLocale) => Promise<void>;
  t: (key: string, options?: TranslateOptions) => string;
  locales: readonly AppLocale[];
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale | null>(null);
  const [ready, setReady] = useState(false);
  /** Bump to force consumers to re-read i18n.t after locale change. */
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadStoredLocale();
      const next = stored ?? resolveDeviceLocale();
      if (cancelled) return;
      setI18nLocale(next);
      setLocaleState(next);
      setReady(true);
      setTick((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (next: AppLocale) => {
    setI18nLocale(next);
    setLocaleState(next);
    setTick((n) => n + 1);
    await saveStoredLocale(next);
  }, []);

  const t = useCallback(
    (key: string, options?: TranslateOptions) => translate(key, options),
    // tick forces new closure identity when locale changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, locale],
  );

  const value = useMemo(
    () => ({
      locale: locale ?? 'fr',
      ready,
      setLocale,
      t,
      locales: APP_LOCALES,
    }),
    [locale, ready, setLocale, t],
  );

  // Hold UI until AsyncStorage locale is resolved — avoids flashing device locale
  // over a persisted EN/FR/ES choice (Bugbot: stored locale ignored on first paint).
  if (!ready || locale == null) {
    return (
      <I18nContext.Provider value={value}>
        <View style={{ flex: 1, backgroundColor: colors.paper }} />
      </I18nContext.Provider>
    );
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
