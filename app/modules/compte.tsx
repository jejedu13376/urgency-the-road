import { useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
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
import { colors } from '../../src/theme/colors';
import { useI18n } from '../../src/context/I18nContext';

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

  return (
    <>
      <Stack.Screen options={{ title: t('moduleTitles.compte') }} />
      <Screen
        variant="stack" title={t('moduleTitles.compte')} subtitle={t('moduleTitles.compteSub')}>
        <BackendStatusBanner />
        <StubBanner text={paymentsStatusLabel()} />

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
            <Pressable style={[styles.btn, { flex: 1 }]} onPress={() => void onSignUp()}>
              <Text style={styles.btnTxt}>S’inscrire</Text>
            </Pressable>
            <Pressable style={[styles.btnDark, { flex: 1 }]} onPress={() => void onSignIn()}>
              <Text style={styles.btnTxt}>Connexion</Text>
            </Pressable>
          </View>
          <Pressable style={[styles.btnDark, { marginTop: 8 }]} onPress={() => void onResendVerify()}>
            <Text style={styles.btnTxt}>Renvoyer l’email de vérification</Text>
          </Pressable>
          {authMsg ? <Text style={styles.msg}>{authMsg}</Text> : null}
        </Card>

        <Card title="Authentification biométrique">
          <Pressable style={styles.btnDark} onPress={() => void tryBio()}>
            <Text style={styles.btnTxt}>Empreinte / Face ID</Text>
          </Pressable>
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

        <Card title="Formules d’abonnement">
          {MOCK_PLANS.map((p) => (
            <View key={p.id} style={styles.plan}>
              <Text style={styles.planName}>
                {p.name} — {p.priceMonthly} {p.currency}/mois
              </Text>
              <Text style={styles.meta}>{p.perks.join(' · ')}</Text>
              <Pressable
                style={[styles.pay, paying && styles.payDisabled]}
                disabled={paying}
                onPress={() => void payPlan(p.id)}
              >
                <Text style={styles.btnTxt}>
                  {paying
                    ? 'Ouverture…'
                    : `Payer · ${PAYMENT_METHODS.find((x) => x.id === method)?.label ?? method}`}
                </Text>
              </Pressable>
            </View>
          ))}
          {pay ? (
            <Text style={[styles.msg, isMethodConfigured(method) ? styles.ok : styles.bad]}>{pay}</Text>
          ) : null}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
  },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnDark: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnTxt: { color: colors.white, fontWeight: '800' },
  msg: { fontWeight: '700', fontSize: 12 },
  ok: { color: colors.garage },
  bad: { color: colors.danger },
  meta: { color: colors.muted, fontSize: 12 },
  rule: { color: colors.slate, fontSize: 12, fontWeight: '600' },
  methods: { gap: 8, marginTop: 8 },
  method: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
  },
  methodOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  methodTitle: { fontWeight: '800', color: colors.ink },
  methodTitleOn: { color: colors.white },
  methodHint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  methodHintOn: { color: '#C5D2DE' },
  plan: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  planName: { fontWeight: '800', color: colors.ink },
  pay: { backgroundColor: colors.garage, borderRadius: 8, padding: 10, alignItems: 'center' },
  payDisabled: { opacity: 0.6 },
});
