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
import { stubPayment } from '../../src/services/stubs';
import { colors } from '../../src/theme/colors';

function validatePassword(pw: string) {
  const ok = pw.length >= 6 && /[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
  return ok
    ? 'Mot de passe conforme (6+ · 1 majuscule · 1 spécial).'
    : 'Invalidé : min. 6 caractères, 1 majuscule, 1 caractère spécial.';
}

/** Module 15 — inscription, biométrie, abonnements, Lydia stub. */
export default function CompteScreen() {
  useModuleVisit(15);
  const { refresh, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);

  const tryBio = async () => {
    const has = await LocalAuthentication.hasHardwareAsync();
    if (!has) {
      setBio('STUB bio — matériel non dispo ici ; API prête (empreinte / Face ID).');
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Connexion Urgence Mécanique',
    });
    setBio(res.success ? 'Biométrie OK' : 'Biométrie annulée / échec');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Compte' }} />
      <Screen title="Compte & abonnements" subtitle="Module 15">
        <BackendStatusBanner />
        <StubBanner text="STUB paiement — Lydia / Stripe / Apple Pay / Google Pay non branchés" />
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
          <Pressable style={styles.btn} onPress={() => setPwMsg(validatePassword(pw))}>
            <Text style={styles.btnTxt}>Valider mot de passe</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[styles.btn, { flex: 1 }]}
              onPress={() =>
                void signUpEmail(email, pw).then(async (r) => {
                  setAuthMsg(r.stubLabel ?? `Compte ${r.data.email}`);
                  await refresh();
                })
              }
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
          {pwMsg ? <Text style={styles.msg}>{pwMsg}</Text> : null}
          {authMsg ? <Text style={styles.msg}>{authMsg}</Text> : null}
        </Card>
        <Card title="Authentification biométrique">
          <Pressable style={styles.btnDark} onPress={() => void tryBio()}>
            <Text style={styles.btnTxt}>Empreinte / Face ID</Text>
          </Pressable>
          {bio ? <Text style={styles.msg}>{bio}</Text> : null}
          <Text style={styles.meta}>Chiffrement bout-en-bout : engagement produit (non implémenté crypto ici).</Text>
        </Card>
        <Card title="Formules">
          {MOCK_PLANS.map((p) => (
            <View key={p.id} style={styles.plan}>
              <Text style={styles.planName}>
                {p.name} — {p.priceMonthly} {p.currency}/mois
              </Text>
              <Text style={styles.meta}>{p.perks.join(' · ')}</Text>
              <Pressable
                style={styles.pay}
                onPress={() => {
                  const r = stubPayment(p.id);
                  setPay(`${r.label} · plan ${r.data.planId}`);
                }}
              >
                <Text style={styles.btnTxt}>Payer (Lydia stub)</Text>
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
  },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnDark: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnTxt: { color: colors.white, fontWeight: '800' },
  msg: { color: colors.garage, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12 },
  plan: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  planName: { fontWeight: '800', color: colors.ink },
  pay: { backgroundColor: colors.garage, borderRadius: 8, padding: 10, alignItems: 'center' },
});
