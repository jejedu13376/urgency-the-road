import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BRAND_NAME } from '../brand';
import { PREMIUM_PRICE_MONTHLY_USD } from '../constants/subscription';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useRegisterGate } from '../context/RegisterGateContext';
import { signInEmail, signUpEmail } from '../services/firebase/authService';
import {
  captureReferralFromUrl,
  loadPendingReferralCode,
  savePendingReferralCode,
} from '../services/referral/referralService';
import {
  isValidDisplayName,
  isValidEmail,
  loadLocalUserProfile,
  mergeAutofill,
  validatePassword,
} from '../services/prefs/userProfileLocal';
import { colors } from '../theme/colors';

/** First launch — must register or sign in before the 17-module app unlocks. */
export function RegisterGateScreen() {
  const { t } = useI18n();
  const { refresh, profile } = useAuth();
  const { completeRegistration } = useRegisterGate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pw, setPw] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Once the user edits referral, never overwrite from profile refresh / deep link reseed. */
  const referralTouchedRef = useRef(false);
  const referralSeededRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = await loadLocalUserProfile();
      if (cancelled) return;
      const seed = mergeAutofill(local, profile);
      setEmail(seed.email);
      setDisplayName(seed.displayName);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  // Seed referral once on mount — do not re-run when Auth refresh mutates profile.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (referralSeededRef.current || referralTouchedRef.current) return;
      const pending = await loadPendingReferralCode();
      if (cancelled || referralTouchedRef.current) return;
      if (pending) {
        setReferralCode(pending);
        referralSeededRef.current = true;
      }
      try {
        const initial = await Linking.getInitialURL();
        if (initial && !cancelled && !referralTouchedRef.current) {
          const captured = await captureReferralFromUrl(initial);
          if (captured && !referralTouchedRef.current) {
            setReferralCode(captured);
            referralSeededRef.current = true;
          }
        }
      } catch {
        // soft-fail deep link
      }
    })();
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (referralTouchedRef.current) return;
      void captureReferralFromUrl(url).then((c) => {
        if (c && !referralTouchedRef.current) setReferralCode(c);
      });
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const onRegister = async () => {
    if (!isValidEmail(email)) {
      setMsg(t('registerGate.invalidEmail'));
      return;
    }
    if (!displayName.trim() || !isValidDisplayName(displayName)) {
      setMsg(t('registerGate.invalidName'));
      return;
    }
    const v = validatePassword(pw);
    setPwOk(v.ok);
    setPwMsg(v.ok ? t('registerGate.pwOk') : t('registerGate.pwBad'));
    if (!v.ok) {
      setMsg(t('registerGate.pwBlock'));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (referralCode.trim()) await savePendingReferralCode(referralCode.trim());
      const r = await signUpEmail(email, pw, displayName.trim(), referralCode.trim() || null);
      if (r.ok === false) {
        setMsg(r.stubLabel ?? t('registerGate.signUpFail'));
        return;
      }
      await refresh();
      await completeRegistration({ email, displayName: displayName.trim() });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('registerGate.signUpFail'));
    } finally {
      setBusy(false);
    }
  };

  const onSignIn = async () => {
    if (!isValidEmail(email)) {
      setMsg(t('registerGate.invalidEmail'));
      return;
    }
    if (!pw) {
      setMsg(t('registerGate.needPassword'));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await signInEmail(email, pw);
      if (r.ok === false) {
        setMsg(r.stubLabel ?? t('registerGate.signInFail'));
        return;
      }
      await refresh();
      await completeRegistration({
        email,
        displayName: displayName.trim() || r.data?.displayName || '',
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('registerGate.signInFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>{BRAND_NAME}</Text>
        <Text style={styles.title}>{t('registerGate.title')}</Text>
        <Text style={styles.sub}>{t('registerGate.sub')}</Text>

        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('registerGate.namePh')}
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="words"
          testID="register-gate-name"
          accessibilityLabel={t('registerGate.namePh')}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('registerGate.emailPh')}
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          testID="register-gate-email"
          accessibilityLabel={t('registerGate.emailPh')}
        />
        <TextInput
          value={pw}
          onChangeText={(txt) => {
            setPw(txt);
            const v = validatePassword(txt);
            setPwOk(v.ok);
            setPwMsg(txt ? (v.ok ? t('registerGate.pwOk') : t('registerGate.pwBad')) : null);
          }}
          placeholder={t('registerGate.passwordPh')}
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          testID="register-gate-password"
          accessibilityLabel={t('registerGate.passwordPh')}
        />
        {pwMsg ? (
          <Text style={[styles.hint, pwOk ? styles.ok : styles.bad]}>{pwMsg}</Text>
        ) : (
          <Text style={styles.hint}>{t('registerGate.pwRule')}</Text>
        )}

        <TextInput
          value={referralCode}
          onChangeText={(txt) => {
            referralTouchedRef.current = true;
            setReferralCode(txt);
          }}
          placeholder={t('referral.codePlaceholder')}
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
          testID="register-gate-referral"
          accessibilityLabel={t('referral.codePlaceholder')}
        />
        <Text style={styles.hint}>
          {t('referral.signupHint', { price: PREMIUM_PRICE_MONTHLY_USD })}
        </Text>

        <Pressable
          style={[styles.btn, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void onRegister()}
          testID="register-gate-signup"
          accessibilityRole="button"
          accessibilityLabel={t('registerGate.signUp')}
        >
          <Text style={styles.btnTxt}>{t('registerGate.signUp')}</Text>
        </Pressable>
        <Pressable
          style={[styles.btnDark, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void onSignIn()}
          testID="register-gate-signin"
          accessibilityRole="button"
          accessibilityLabel={t('registerGate.signIn')}
        >
          <Text style={styles.btnTxt}>{t('registerGate.signIn')}</Text>
        </Pressable>
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.asphalt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 22,
    gap: 10,
  },
  brand: {
    color: colors.signal,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  sub: { color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.mist,
  },
  hint: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  ok: { color: colors.garage },
  bad: { color: colors.danger },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDark: {
    backgroundColor: colors.asphalt,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 15 },
  msg: { color: colors.ink, fontWeight: '700', fontSize: 12, marginTop: 4 },
});
