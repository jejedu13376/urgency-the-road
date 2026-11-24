import { useCallback, useEffect, useState } from 'react';
import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { LanguagePicker } from '../../src/components/LanguagePicker';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/context/I18nContext';
import { signInEmail, signUpEmail } from '../../src/services/firebase/authService';
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
import {
  isValidDisplayName,
  isValidEmail,
  isValidPhone,
  loadLocalUserProfile,
  mergeAutofill,
  saveLocalUserProfile,
  validatePassword,
  type LocalUserProfile,
} from '../../src/services/prefs/userProfileLocal';
import { getSupportEmail } from '../../src/services/support/companySupport';
import { colors } from '../../src/theme/colors';

/**
 * Hub Paramètres — credentials / personal (autofill · validate · persist) +
 * préférences / notifications + liens Compte / Support / Bases.
 */
export default function ParametresHub() {
  const { profile, refresh } = useAuth();
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<LocalPrefs>(DEFAULT_LOCAL_PREFS);
  const [notifs, setNotifs] = useState<LocalNotifs>(DEFAULT_LOCAL_NOTIFS);
  const [ready, setReady] = useState(false);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [credMsg, setCredMsg] = useState<string | null>(null);
  const [personalMsg, setPersonalMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyAutofill = useCallback((local: LocalUserProfile, auth: typeof profile) => {
    const seed = mergeAutofill(local, auth);
    setEmail(seed.email);
    setDisplayName(seed.displayName);
    setPhone(local.phone);
    setCity(local.city);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [p, n, local] = await Promise.all([
          loadLocalPrefs(),
          loadLocalNotifs(),
          loadLocalUserProfile(),
        ]);
        if (cancelled) return;
        setPrefs(p);
        setNotifs(n);
        applyAutofill(local, profile);
      } catch {
        /* mock local — ignore corrupt */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, applyAutofill]);

  const onSmartAutofill = useCallback(async () => {
    const local = await loadLocalUserProfile();
    applyAutofill(local, profile);
    setPersonalMsg(t('settings.autofillDone'));
    setCredMsg(null);
  }, [profile, t, applyAutofill]);

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

  const persistPersonal = async () => {
    if (email && !isValidEmail(email)) {
      setPersonalMsg(t('settings.invalidEmail'));
      return;
    }
    if (!isValidDisplayName(displayName)) {
      setPersonalMsg(t('settings.invalidName'));
      return;
    }
    if (!isValidPhone(phone)) {
      setPersonalMsg(t('settings.invalidPhone'));
      return;
    }
    await saveLocalUserProfile({ email, displayName, phone, city });
    setPersonalMsg(t('settings.personalSaved'));
  };

  const onSignIn = async () => {
    if (!isValidEmail(email)) {
      setCredMsg(t('settings.invalidEmail'));
      return;
    }
    if (!pw) {
      setCredMsg(t('settings.needPassword'));
      return;
    }
    setBusy(true);
    setCredMsg(null);
    try {
      const r = await signInEmail(email, pw);
      if (r.ok === false) {
        setCredMsg(r.stubLabel ?? t('settings.signInFail'));
        return;
      }
      await saveLocalUserProfile({ email, displayName });
      await refresh();
      setCredMsg(r.stubLabel ?? t('settings.signInOk', { email }));
      setPw('');
    } catch (e) {
      setCredMsg(e instanceof Error ? e.message : t('settings.signInFail'));
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async () => {
    if (!isValidEmail(email)) {
      setCredMsg(t('settings.invalidEmail'));
      return;
    }
    const v = validatePassword(pw);
    setPwOk(v.ok);
    setPwMsg(v.ok ? t('settings.pwOk') : t('settings.pwBad'));
    if (!v.ok) {
      setCredMsg(t('settings.pwBlock'));
      return;
    }
    setBusy(true);
    setCredMsg(null);
    try {
      const r = await signUpEmail(email, pw, displayName.trim() || undefined);
      if (r.ok === false) {
        setCredMsg(r.stubLabel ?? t('settings.signUpFail'));
        return;
      }
      await saveLocalUserProfile({ email, displayName });
      await refresh();
      setCredMsg(r.stubLabel ?? t('settings.signUpOk'));
      setPw('');
    } catch (e) {
      setCredMsg(e instanceof Error ? e.message : t('settings.signUpFail'));
    } finally {
      setBusy(false);
    }
  };

  const supportEmail = getSupportEmail();

  return (
    <>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <Screen variant="stack" title={t('settings.title')} subtitle={t('settings.subtitle')}>
        <StubBanner text={t('settings.stub')} />

        <Card title={t('language')}>
          <LanguagePicker showTitle={false} />
          <Text style={styles.hint}>{t('languageHint')}</Text>
        </Card>

        <Card title={t('settings.credentials')}>
          <Text style={styles.meta}>
            {profile?.email
              ? t('settings.connected', { email: profile.email })
              : t('settings.notConnected')}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('settings.emailPh')}
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            accessibilityLabel={t('settings.emailPh')}
          />
          <TextInput
            value={pw}
            onChangeText={(txt) => {
              setPw(txt);
              if (!txt) {
                setPwMsg(null);
                return;
              }
              const v = validatePassword(txt);
              setPwOk(v.ok);
              setPwMsg(v.ok ? t('settings.pwOk') : t('settings.pwBad'));
            }}
            placeholder={t('settings.passwordPh')}
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            accessibilityLabel={t('settings.passwordPh')}
          />
          {pwMsg ? (
            <Text style={[styles.msg, pwOk ? styles.ok : styles.bad]}>{pwMsg}</Text>
          ) : (
            <Text style={styles.hint}>{t('settings.pwRule')}</Text>
          )}
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.flex, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void onSignUp()}
            >
              <Text style={styles.btnTxt}>{t('settings.signUp')}</Text>
            </Pressable>
            <Pressable
              style={[styles.btnDark, styles.flex, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void onSignIn()}
            >
              <Text style={styles.btnTxt}>{t('settings.signIn')}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.linkGhost} onPress={() => void onSmartAutofill()}>
            <Text style={styles.linkGhostTxt}>{t('settings.smartAutofill')}</Text>
          </Pressable>
          {credMsg ? <Text style={styles.msg}>{credMsg}</Text> : null}
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
        </Card>

        <Card title={t('settings.personal')}>
          <Text style={styles.hint}>{t('settings.personalHint')}</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('settings.namePh')}
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="words"
            accessibilityLabel={t('settings.namePh')}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t('settings.phonePh')}
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="phone-pad"
            accessibilityLabel={t('settings.phonePh')}
          />
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder={t('settings.cityPh')}
            placeholderTextColor={colors.muted}
            style={styles.input}
            accessibilityLabel={t('settings.cityPh')}
          />
          <Pressable style={styles.btnDark} onPress={() => void persistPersonal()}>
            <Text style={styles.btnTxt}>{t('settings.savePersonal')}</Text>
          </Pressable>
          {personalMsg ? <Text style={styles.msg}>{personalMsg}</Text> : null}
        </Card>

        <Card title={t('settings.account')}>
          <Link href="/modules/support" asChild>
            <Pressable
              style={styles.linkRow}
              accessibilityRole="button"
              accessibilityLabel={t('settings.openSupportA11y')}
            >
              <Text style={styles.id}>SUP</Text>
              <Text style={styles.linkTxt}>
                {t('settings.openSupport')} · {supportEmail}
              </Text>
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
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
    marginTop: 8,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  flex: { flex: 1 },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnDark: {
    backgroundColor: colors.asphalt,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  disabled: { opacity: 0.6 },
  btnTxt: { color: colors.white, fontWeight: '800' },
  msg: { fontWeight: '700', fontSize: 12, marginTop: 6 },
  ok: { color: colors.garage },
  bad: { color: colors.danger },
  linkGhost: { marginTop: 8, paddingVertical: 4 },
  linkGhostTxt: { color: colors.signal, fontWeight: '700', fontSize: 12 },
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
