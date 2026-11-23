import { useMemo, useState } from 'react';
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
import { signInEmail, signUpEmail } from '../../src/services/firebase';
import {
  isPaymentsConfigured,
  paymentsStatusLabel,
  startCheckout,
} from '../../src/services/payments/paymentsService';
import { colors } from '../../src/theme/colors';

type PayMethod = 'lydia' | 'stripe' | 'apple_pay' | 'google_pay';

function validatePassword(pw: string) {
  const rules = {
    length: pw.length >= 6,
    upper: /[A-Z]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const ok = rules.length && rules.upper && rules.special;
  return {
    ok,
    rules,
    message: ok
      ? 'Mot de passe conforme (6+ · 1 majuscule · 1 spécial).'
      : 'Invalidé : min. 6 caractères, 1 majuscule, 1 caractère spécial.',
  };
}

/** Module 15 — inscription, biométrie, abonnements Lydia / Stripe. */
export default function CompteScreen() {
  useModuleVisit(15);
  const { refresh, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pwCheck, setPwCheck] = useState<ReturnType<typeof validatePassword> | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>('stripe');

  const liveRules = useMemo(() => validatePassword(pw), [pw]);

  const tryBio = async () => {
    const has = await LocalAuthentication.hasHardwareAsync();
    if (!has) {
      setBio('STUB bio — matériel non dispo ici ; API prête (empreinte / Face ID).');
      return;
    }
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      setBio('Biométrie non configurée sur l’appareil — enregistrez Face ID / empreinte.');
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Connexion Urgence Mécanique',
    });
    setBio(res.success ? 'Biométrie OK — session locale' : 'Biométrie annulée / échec');
  };

  const payLabel = (m: PayMethod) => {
    if (m === 'lydia') return 'Lydia (FR)';
    if (m === 'stripe') return 'Stripe Checkout';
    if (m === 'apple_pay') return 'Apple Pay';
    return 'Google Pay';
  };

  const onCheckout = async (planId: string) => {
    if (method === 'lydia') {
      setPay(
        'Lydia : label prêt — branchez le SDK / deep-link Lydia (pas de succès fictif). Méthode sélectionnée : Lydia.',
      );
      return;
    }
    if (method === 'apple_pay' || method === 'google_pay') {
      setPay(
        `${payLabel(method)} : nécessite build natif (StoreKit / Google Play Billing) — non simulé ici.`,
      );
      return;
    }
    const r = await startCheckout(planId);
    setPay(`${r.message}${r.checkoutUrl ? ` · ${r.checkoutUrl}` : ''} · provider ${r.provider}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Compte' }} />
      <Screen title="Compte & abonnements" subtitle="Module 15 — sécurité · Lydia · Stripe">
        <BackendStatusBanner />
        <StubBanner text={paymentsStatusLabel()} />

        <Card title="Inscription / Auth Firebase">
          <Text style={styles.meta}>Profil : {profile?.email ?? 'non connecté (mock possible)'}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={pw}
            onChangeText={setPw}
            placeholder="Mot de passe"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
          />
          <View style={styles.rules}>
            <Text style={[styles.rule, liveRules.rules.length && styles.ruleOk]}>
              {liveRules.rules.length ? '✓' : '○'} Min. 6 caractères
            </Text>
            <Text style={[styles.rule, liveRules.rules.upper && styles.ruleOk]}>
              {liveRules.rules.upper ? '✓' : '○'} 1 lettre majuscule
            </Text>
            <Text style={[styles.rule, liveRules.rules.special && styles.ruleOk]}>
              {liveRules.rules.special ? '✓' : '○'} 1 caractère spécial
            </Text>
          </View>
          <Pressable style={styles.btn} onPress={() => setPwCheck(validatePassword(pw))}>
            <Text style={styles.btnTxt}>Valider mot de passe</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[styles.btn, { flex: 1 }]}
              onPress={() => {
                const v = validatePassword(pw);
                setPwCheck(v);
                if (!v.ok) {
                  setAuthMsg(v.message);
                  return;
                }
                void signUpEmail(email, pw).then(async (r) => {
                  setAuthMsg(r.stubLabel ?? `Compte ${r.data.email}`);
                  await refresh();
                });
              }}
            >
              <Text style={styles.btnTxt}>S’inscrire</Text>
            </Pressable>
            <Pressable
              style={[styles.btnDark, { flex: 1 }]}
              onPress={() =>
                void signInEmail(email, pw).then(async (r) => {
                  setAuthMsg(r.stubLabel ?? `Connecté ${r.data.email}`);
                  await refresh();
                })
              }
            >
              <Text style={styles.btnTxt}>Connexion</Text>
            </Pressable>
          </View>
          {pwCheck ? (
            <Text style={[styles.msg, !pwCheck.ok && styles.msgBad]}>{pwCheck.message}</Text>
          ) : null}
          {authMsg ? <Text style={styles.msg}>{authMsg}</Text> : null}
        </Card>

        <Card title="Authentification biométrique">
          <Text style={styles.meta}>
            Empreinte digitale ou reconnaissance faciale (Apple / Samsung / Google). Chiffrement
            bout-en-bout : engagement produit.
          </Text>
          <Pressable style={styles.btnDark} onPress={() => void tryBio()}>
            <Text style={styles.btnTxt}>Empreinte / Face ID</Text>
          </Pressable>
          {bio ? <Text style={styles.msg}>{bio}</Text> : null}
        </Card>

        <Card title="Méthode de paiement">
          <View style={styles.payMethods}>
            {(['stripe', 'lydia', 'apple_pay', 'google_pay'] as PayMethod[]).map((m) => (
              <Pressable
                key={m}
                style={[styles.payChip, method === m && styles.payChipOn]}
                onPress={() => setMethod(m)}
              >
                <Text style={[styles.payChipTxt, method === m && styles.payChipTxtOn]}>
                  {payLabel(m)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>
            Sélection : {payLabel(method)} ·{' '}
            {isPaymentsConfigured() ? 'config partielle détectée' : 'clés .env absentes'}
          </Text>
        </Card>

        <Card title="Formules d’abonnement">
          {MOCK_PLANS.map((p) => (
            <View key={p.id} style={styles.plan}>
              <Text style={styles.planName}>
                {p.name} — {p.priceMonthly} {p.currency}/mois
              </Text>
              <Text style={styles.meta}>{p.perks.join(' · ')}</Text>
              <Pressable style={styles.pay} onPress={() => void onCheckout(p.id)}>
                <Text style={styles.btnTxt}>
                  Payer via {payLabel(method)}
                  {!isPaymentsConfigured() && method === 'stripe' ? ' (.env)' : ''}
                </Text>
              </Pressable>
            </View>
          ))}
          {pay ? <Text style={styles.msg}>{pay}</Text> : null}
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
    marginTop: 6,
  },
  rules: { gap: 4, marginTop: 8 },
  rule: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  ruleOk: { color: colors.garage },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  btnDark: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 12, textAlign: 'center' },
  msg: { color: colors.garage, fontWeight: '700', marginTop: 6 },
  msgBad: { color: colors.danger },
  meta: { color: colors.muted, fontSize: 12 },
  plan: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  planName: { fontWeight: '800', color: colors.ink },
  pay: { backgroundColor: colors.garage, borderRadius: 8, padding: 10, alignItems: 'center' },
  payMethods: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  payChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.mist,
  },
  payChipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  payChipTxt: { fontWeight: '700', color: colors.slate, fontSize: 11 },
  payChipTxtOn: { color: colors.white },
});
