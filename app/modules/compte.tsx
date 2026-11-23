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
import { signInEmail, signUpEmail } from '../../src/services/firebase';
import {
  isPaymentsConfigured,
  paymentsStatusLabel,
  startCheckout,
} from '../../src/services/payments/paymentsService';
import { colors } from '../../src/theme/colors';

function validatePassword(pw: string) {
  const ok = pw.length >= 6 && /[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
  return {
    ok,
    msg: ok
      ? 'Mot de passe conforme (6+ · 1 majuscule · 1 caractère spécial).'
      : 'Invalidé : min. 6 caractères, 1 majuscule, 1 caractère spécial.',
  };
}

/** Module 15 — inscription, biométrie, abonnements (paiement sans faux succès). */
export default function CompteScreen() {
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
    const r = await startCheckout(planId);
    setPaying(false);
    setPay(r.message);
  };

  const onSignUp = async () => {
    const v = validatePassword(pw);
    setPwMsg(v.msg);
    setPwOk(v.ok);
    if (!v.ok) {
      setAuthMsg('Inscription bloquée — mot de passe non conforme.');
      return;
    }
    const r = await signUpEmail(email, pw);
    setAuthMsg(r.stubLabel ?? `Compte ${r.data.email}`);
    await refresh();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Compte' }} />
      <Screen title="Compte & abonnements" subtitle="Module 15">
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
            onChangeText={(t) => {
              setPw(t);
              const v = validatePassword(t);
              setPwOk(v.ok);
              setPwMsg(v.msg);
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
          {authMsg ? <Text style={styles.msg}>{authMsg}</Text> : null}
        </Card>

        <Card title="Authentification biométrique">
          <Pressable style={styles.btnDark} onPress={() => void tryBio()}>
            <Text style={styles.btnTxt}>Empreinte / Face ID</Text>
          </Pressable>
          {bio ? <Text style={styles.msg}>{bio}</Text> : null}
          <Text style={styles.meta}>
            Chiffrement bout-en-bout : engagement produit (couche crypto à brancher côté backend).
          </Text>
        </Card>

        <Card title="Formules d’abonnement">
          <Text style={styles.meta}>
            Particulier · Routier Pro · Flotte — Lydia / Stripe / Apple Pay / Google Pay.
            {!isPaymentsConfigured()
              ? ' Paiement refusé tant que les clés ne sont pas configurées (aucun succès simulé).'
              : ' Clés présentes ; SDK checkout encore à brancher.'}
          </Text>
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
                <Text style={styles.btnTxt}>{paying ? 'Vérification…' : 'Payer (Lydia / Stripe)'}</Text>
              </Pressable>
            </View>
          ))}
          {pay ? (
            <Text style={[styles.msg, isPaymentsConfigured() ? styles.ok : styles.bad]}>{pay}</Text>
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
  plan: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  planName: { fontWeight: '800', color: colors.ink },
  pay: { backgroundColor: colors.garage, borderRadius: 8, padding: 10, alignItems: 'center' },
  payDisabled: { opacity: 0.6 },
});
