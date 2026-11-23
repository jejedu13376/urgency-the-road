import { useCallback, useEffect, useState } from 'react';
import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { LanguagePicker } from '../../src/components/LanguagePicker';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/context/I18nContext';
import {
  DEFAULT_LOCAL_NOTIFS,
  DEFAULT_LOCAL_PREFS,
  loadLocalNotifs,
  loadLocalPrefs,
  saveLocalNotifs,
  saveLocalPrefs,
  type LocalNotifs,
  type LocalPrefs,
} from '../../src/services/prefs/localPrefs';
import { colors } from '../../src/theme/colors';

/**
 * Hub Paramètres — préférences / notifications locales + liens Compte (M15) / Bases (M14).
 * Ne compte pas comme un module du parcours 17.
 */
export default function ParametresHub() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<LocalPrefs>(DEFAULT_LOCAL_PREFS);
  const [notifs, setNotifs] = useState<LocalNotifs>(DEFAULT_LOCAL_NOTIFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [p, n] = await Promise.all([loadLocalPrefs(), loadLocalNotifs()]);
        if (cancelled) return;
        setPrefs(p);
        setNotifs(n);
      } catch {
        /* mock local — ignore corrupt */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchPrefs = useCallback(async (patch: Partial<LocalPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void saveLocalPrefs(next);
      return next;
    });
  }, []);

  const patchNotifs = useCallback(async (patch: Partial<LocalNotifs>) => {
    setNotifs((prev) => {
      const next = { ...prev, ...patch };
      void saveLocalNotifs(next);
      return next;
    });
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <Screen variant="stack" title={t('settings.title')} subtitle={t('settings.subtitle')}>
        <StubBanner text={t('settings.stub')} />

        <Card title={t('language')}>
          <LanguagePicker showTitle={false} />
          <Text style={styles.hint}>{t('languageHint')}</Text>
        </Card>

        <Card title={t('settings.account')}>
          <Text style={styles.meta}>
            {profile?.email
              ? t('settings.connected', { email: profile.email })
              : t('settings.notConnected')}
          </Text>
          <Link href="/modules/compte" asChild>
            <Pressable
              style={styles.linkRow}
              accessibilityRole="button"
              accessibilityLabel={t('settings.openCompteA11y')}
            >
              <Text style={styles.id}>M15</Text>
              <Text style={styles.linkTxt}>{t('settings.openCompte')}</Text>
            </Pressable>
          </Link>
          <Link href="/modules/bases" asChild>
            <Pressable
              style={styles.linkRow}
              accessibilityRole="button"
              accessibilityLabel={t('settings.openBasesA11y')}
            >
              <Text style={styles.id}>M14</Text>
              <Text style={styles.linkTxt}>{t('settings.openBases')}</Text>
            </Pressable>
          </Link>
        </Card>

        <Card title={t('settings.prefs')}>
          {!ready ? (
            <Text style={styles.meta}>{t('loading')}</Text>
          ) : (
            <>
              <ToggleRow
                label={t('settings.metric')}
                value={prefs.metricUnits}
                onChange={(v) => void patchPrefs({ metricUnits: v })}
              />
              <ToggleRow
                label={t('settings.darkChrome')}
                value={prefs.darkChrome}
                onChange={(v) => void patchPrefs({ darkChrome: v })}
              />
              <ToggleRow
                label={t('settings.showWeather')}
                value={prefs.showWeather}
                onChange={(v) => void patchPrefs({ showWeather: v })}
              />
              <Text style={styles.hint}>{t('settings.weatherHint')}</Text>
            </>
          )}
        </Card>

        <Card title={t('settings.notifs')}>
          {!ready ? (
            <Text style={styles.meta}>{t('loading')}</Text>
          ) : (
            <>
              <ToggleRow
                label={t('settings.notifEntretien')}
                value={notifs.entretien}
                onChange={(v) => void patchNotifs({ entretien: v })}
              />
              <ToggleRow
                label={t('settings.notifSos')}
                value={notifs.sos}
                onChange={(v) => void patchNotifs({ sos: v })}
              />
              <ToggleRow
                label={t('settings.notifFil')}
                value={notifs.fil}
                onChange={(v) => void patchNotifs({ fil: v })}
              />
              <ToggleRow
                label={t('settings.notifMarketing')}
                value={notifs.marketing}
                onChange={(v) => void patchNotifs({ marketing: v })}
              />
              <Text style={styles.hint}>{t('settings.notifHint')}</Text>
            </>
          )}
        </Card>
      </Screen>
    </>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.signalSoft }}
        thumbColor={value ? colors.signal : colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 11, marginTop: 4 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  id: {
    backgroundColor: colors.asphalt,
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  linkTxt: { color: colors.signal, fontWeight: '800', fontSize: 13, flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 12,
  },
  toggleLabel: { color: colors.ink, fontWeight: '600', fontSize: 13, flex: 1 },
});
