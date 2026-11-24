import { useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { BRAND_NAME } from '../../src/brand';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/context/I18nContext';
import { MOCK_PLANS } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  isCurrentEmailVerified,
  resendEmailVerification,
  signInEmail,
  signUpEmail,
} from '../../src/services/firebase';
import {
  isMethodConfigured,
  isPaymentsConfigured,
  PAYMENT_METHODS,
  paymentsStatusLabel,
  startCheckout,
  type PaymentMethod,
} from '../../src/services/payments/paymentsService';
import { validatePassword } from '../../src/services/prefs/userProfileLocal';
import { resolveInstallUrl, shareInstallLink } from '../../src/services/share/installUrl';
import { colors } from '../../src/theme/colors';
import { FadeInBlock, PressScale } from '../../src/theme/motion';

/** Module 15 — Auth, bio, abonnements : Stripe · PayPal · Apple Pay · Google Pay (pas de Lydia). */
export default function CompteScreen() {
  const { t } = useI18n();
  useModuleVisit(15);
  const { refresh, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [bio, setBio] = useState<string | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('stripe_card');
  const [referralMsg, setReferralMsg] = useState<string | null>(null);

  const install = resolveInstallUrl();
  const canShareLink = install.configured && install.url.startsWith('http');

  const tryBio = async () => {
    const has = await LocalAuthentication.hasHardwareAsync();
    if (!has) {
      setBio('Biométrie indisponible sur cet appareil — API prête (empreinte / Face ID).');
      return;
    }
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      setBio('Aucun biométrique enregistré sur l’appareil.');
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Connexion Urgence Mécanique',
      cancelLabel: 'Annuler',
    });
    setBio(res.success ? 'Biométrie OK — session déverrouillée' : 'Biométrie annulée / échec');
  };

  const payPlan = async (planId: string) => {
    setPaying(true);
    const r = await startCheckout(planId, method);
    setPaying(false);
    setPay(r.message);
  };

  const onSignUp = async () => {
    const v = validatePassword(pw);
    setPwMsg(v.msgFr);
    setPwOk(v.ok);
    if (!v.ok) {
      setAuthMsg('Inscription bloquée — mot de passe non conforme.');
      return;
    }
    try {
      const r = await signUpEmail(email, pw);
      if (r.ok === false) {
        setAuthMsg(r.stubLabel ?? 'Inscription échouée');
        return;
      }
      setAuthMsg(
        r.stubLabel ??
          `Compte ${r.data?.email ?? email} — vérifie ton email (lien envoyé) avant le Multi-IA LIVE`,
      );
      await refresh();
    } catch (e) {
      setAuthMsg(e instanceof Error ? e.message : 'Inscription échouée');
    }
  };

  const onSignIn = async () => {
    try {
      const r = await signInEmail(email, pw);
      if (r.ok === false) {
        setAuthMsg(r.stubLabel ?? 'Connexion échouée');
        return;
      }
      await refresh();
      const verified = await isCurrentEmailVerified();
      const who = r.data?.email ?? email;
      setAuthMsg(
        verified
          ? (r.stubLabel ?? `Connecté ${who}`)
          : `Connecté ${who} — vérifie ton email pour activer le Multi-IA LIVE`,
      );
    } catch (e) {
      setAuthMsg(e instanceof Error ? e.message : 'Connexion échouée');
    }
  };

  const onResendVerify = async () => {
    const r = await resendEmailVerification();
    setAuthMsg(r.stubLabel ?? (r.ok ? 'Email renvoyé' : 'Échec renvoi'));
  };

  const shareReferral = async () => {
    if (!canShareLink) {
      setReferralMsg(t('referral.needInstallUrl'));
      return;
    }
    const r = await shareInstallLink(install.url, 'FR');
    setReferralMsg(r.ok ? t('referral.shared') : r.message);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('moduleTitles.compte') }} />
      <Screen variant="stack" title={t('moduleTitles.compte')} subtitle={t('moduleTitles.compteSub')}>
        <BackendStatusBanner />
        <StubBanner text={paymentsStatusLabel()} />

        {/* Premium — one composition: brand, price, one CTA */}
        <FadeInBlock>
          <View style={styles.premiumHero} accessibilityLabel={t('subscription.sectionTitle')}>
            <Text style={styles.premiumBrand}>{BRAND_NAME}</Text>
            <Text style={styles.premiumKicker}>{t('subscription.sectionTitle')}</Text>
            <Text style={styles.premiumPrice}>{t('subscription.priceMonthly')}</Text>
            <Text style={styles.premiumLead}>{t('subscription.unlocksAll')}</Text>
            <Text style={styles.premiumHint}>{t('subscription.perksHint')}</Text>
            {MOCK_PLANS.map((p) => (
              <PressScale
                key={p.id}
                style={[styles.premiumCta, paying && styles.payDisabled]}
                disabled={paying}
                onPress={() => void payPlan(p.id)}
                accessibilityRole="button"
                accessibilityLabel={t('subscription.payCta')}
              >
                <Text style={styles.premiumCtaTxt}>
                  {paying
                    ? t('subscription.paying')
                    : `${t('subscription.payCta')} · ${PAYMENT_METHODS.find((x) => x.id === method)?.label ?? method}`}
                </Text>
              </PressScale>
            ))}
            {pay ? (
              <Text
                style={[
                  styles.msg,
                  isMethodConfigured(method) ? styles.premiumOk : styles.premiumBad,
                ]}
              >
                {pay}
              </Text>
            ) : null}
          </View>
        </FadeInBlock>

        <FadeInBlock delayMs={80}>
          <View style={styles.referralBlock}>
            <Text style={styles.referralKicker}>{t('referral.kicker')}</Text>
            <Text style={styles.referralTitle}>{t('referral.title')}</Text>
            <Text style={styles.referralBody}>{t('referral.body')}</Text>
            <PressScale
              style={styles.referralCta}
              onPress={() => void shareReferral()}
              accessibilityRole="button"
              accessibilityLabel={t('referral.shareCta')}
            >
              <Text style={styles.referralCtaTxt}>{t('referral.shareCta')}</Text>
            </PressScale>
            <Link href="/modules/partage" asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={t('referral.openPartage')}>
                <Text style={styles.referralLink}>{t('referral.openPartage')}</Text>
              </Pressable>
            </Link>
            {referralMsg ? <Text style={styles.msg}>{referralMsg}</Text> : null}
          </View>
        </FadeInBlock>

        <Card title="Inscription / Auth">
          <Text style={styles.meta}>Profil : {profile?.email ?? 'non connecté'}</Text>
          <Text style={styles.rule}>
            Mot de passe : minimum 6 caractères, dont au moins 1 majuscule et 1 caractère spécial.
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            value={pw}
            onChangeText={(txt) => {
              setPw(txt);
              const v = validatePassword(txt);
              setPwOk(v.ok);
              setPwMsg(v.msgFr);
            }}
            placeholder="Mot de passe"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
          />
          {pwMsg ? <Text style={[styles.msg, pwOk ? styles.ok : styles.bad]}>{pwMsg}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PressScale style={[styles.btn, { flex: 1 }]} onPress={() => void onSignUp()}>
              <Text style={styles.btnTxt}>S’inscrire</Text>
            </PressScale>
            <PressScale style={[styles.btnDark, { flex: 1 }]} onPress={() => void onSignIn()}>
              <Text style={styles.btnTxt}>Connexion</Text>
            </PressScale>
          </View>
          <Pressable style={[styles.btnDark, { marginTop: 8 }]} onPress={() => void onResendVerify()}>
            <Text style={styles.btnTxt}>Renvoyer l’email de vérification</Text>
          </Pressable>
          {authMsg ? <Text style={styles.msg}>{authMsg}</Text> : null}
        </Card>

        <Card title="Authentification biométrique">
          <PressScale style={styles.btnDark} onPress={() => void tryBio()}>
            <Text style={styles.btnTxt}>Empreinte / Face ID</Text>
          </PressScale>
          {bio ? <Text style={styles.msg}>{bio}</Text> : null}
        </Card>

        <Card title="Moyens de paiement">
          <Text style={styles.meta}>
            Stripe (cartes) · PayPal · Apple Pay · Google Pay — pas de Lydia.
            {!isPaymentsConfigured()
              ? ' Aucun succès simulé tant que les URLs / clés ne sont pas dans .env.'
              : ''}
          </Text>
          <View style={styles.methods}>
            {PAYMENT_METHODS.map((m) => {
              const on = method === m.id;
              const ready = isMethodConfigured(m.id);
              return (
                <Pressable
                  key={m.id}
                  style={[styles.method, on && styles.methodOn]}
                  onPress={() => setMethod(m.id)}
                >
                  <Text style={[styles.methodTitle, on && styles.methodTitleOn]}>{m.label}</Text>
                  <Text style={[styles.methodHint, on && styles.methodHintOn]}>
                    {m.hint}
                    {ready ? ' · prêt' : ' · .env requis'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  premiumHero: {
    backgroundColor: colors.asphalt,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 18,
    gap: 8,
  },
  premiumBrand: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: 34,
  },
  premiumKicker: {
    color: colors.signalSoft,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  premiumPrice: {
    color: colors.signal,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.3,
    lineHeight: 40,
    marginTop: 4,
  },
  premiumLead: {
    color: colors.mist,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 4,
  },
  premiumHint: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  premiumCta: {
    marginTop: 10,
    backgroundColor: colors.signal,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  premiumCtaTxt: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  referralBlock: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  referralKicker: {
    color: colors.signal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  referralTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  referralBody: {
    color: colors.slate,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  referralCta: {
    marginTop: 6,
    backgroundColor: colors.garage,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  referralCtaTxt: { color: colors.white, fontWeight: '900', fontSize: 16 },
  referralLink: {
    color: colors.signal,
    fontWeight: '800',
    fontSize: 15,
    marginTop: 4,
    paddingVertical: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.mist,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 48,
  },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnDark: {
    backgroundColor: colors.asphalt,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 15 },
  msg: { fontWeight: '700', fontSize: 14, lineHeight: 20 },
  ok: { color: colors.garage },
  bad: { color: colors.danger },
  /** High-contrast status on asphalt Premium hero (not garage/danger on dark). */
  premiumOk: { color: colors.garageSoft },
  premiumBad: { color: colors.dangerSoft },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  rule: { color: colors.slate, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  methods: { gap: 8, marginTop: 8 },
  method: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.mist,
  },
  methodOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  methodTitle: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  methodTitleOn: { color: colors.white },
  methodHint: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  methodHintOn: { color: '#C5D2DE' },
  payDisabled: { opacity: 0.6 },
});
