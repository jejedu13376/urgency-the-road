import { useEffect, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { getOwnMedicalCard, scanMedicalCardAsRescuer, upsertMedicalCard } from '../../src/services/firebase';
import type { MedicalCardDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const FOUR_H = 4 * 60 * 60;

/** Module 13 — SOS + medical card (rescuer subscription gate). */
export default function UrgenceScreen() {
  useModuleVisit(13);
  const { profile } = useAuth();
  const [seconds, setSeconds] = useState(0);
  const [pausedAlert, setPausedAlert] = useState(false);
  const [card, setCard] = useState<MedicalCardDoc | null>(null);
  const [scanCode, setScanCode] = useState('UM-DEMO-SCAN-001');
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [label, setLabel] = useState<string | undefined>();

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (seconds >= FOUR_H) setPausedAlert(true);
  }, [seconds]);

  useEffect(() => {
    void (async () => {
      const res = await getOwnMedicalCard(profile?.uid ?? 'mock-local-user');
      setCard(res.data);
      setLabel(res.stubLabel);
    })();
  }, [profile?.uid]);

  const demoAlmost = seconds >= 10 && seconds < FOUR_H;

  const saveCard = async () => {
    const payload: MedicalCardDoc = {
      id: card?.id ?? `med-${profile?.uid ?? 'local'}`,
      ownerUid: profile?.uid ?? 'mock-local-user',
      scanCode: card?.scanCode ?? 'UM-DEMO-SCAN-001',
      fullName: card?.fullName ?? profile?.displayName ?? 'Utilisateur',
      allergies: card?.allergies ?? [],
      conditions: card?.conditions ?? [],
      medications: card?.medications ?? [],
      emergencyContacts: card?.emergencyContacts ?? [],
      bloodType: card?.bloodType,
      updatedAt: new Date().toISOString(),
    };
    const res = await upsertMedicalCard(payload);
    setCard(res.data);
    setLabel(res.stubLabel);
  };

  const onScan = async () => {
    const res = await scanMedicalCardAsRescuer(scanCode, profile);
    setScanMsg(
      res.stubLabel ??
        (res.data
          ? `Fiche : ${res.data.fullName} · allergies ${res.data.allergies.join(', ') || '—'}`
          : 'Aucune fiche'),
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Urgence' }} />
      <Screen title="Urgence & sécurité" subtitle="Module 13">
        <BackendStatusBanner />
        <StubBanner text={label ?? 'Fiche médicale — accès secours = rôle rescuer + abonnement actif'} />
        <Card title="SOS Urgence médicale">
          <Text style={styles.meta}>Bouton rouge flottant SOS (112 FR/EU) toujours visible.</Text>
          <Text style={styles.coords}>Position mock : 50.6292° N, 3.0573° E — Lille</Text>
          <View style={styles.row}>
            <Pressable style={styles.sos} onPress={() => void Linking.openURL('tel:112')}>
              <Text style={styles.sosTxt}>Appeler secours</Text>
            </Pressable>
            <Pressable
              style={styles.share}
              onPress={() =>
                void Share.share({
                  message: 'Urgence — ma position approx. 50.6292, 3.0573 (Lille). Via Urgence Mécanique.',
                })
              }
            >
              <Text style={styles.sosTxt}>SMS / partage</Text>
            </Pressable>
          </View>
        </Card>
        <Card title="Fiche médicale personnelle">
          <Text style={styles.meta}>
            {card
              ? `${card.fullName} · code scan ${card.scanCode} · ${card.allergies.join(', ') || 'pas d’allergie'}`
              : 'Aucune fiche'}
          </Text>
          <Pressable style={styles.btn} onPress={() => void saveCard()}>
            <Text style={styles.sosTxt}>Enregistrer fiche (service)</Text>
          </Pressable>
        </Card>
        <Card title="Scan secours (abonnement requis)">
          <TextInput
            value={scanCode}
            onChangeText={setScanCode}
            style={styles.input}
            placeholder="Code scan"
            placeholderTextColor={colors.muted}
          />
          <Pressable style={styles.share} onPress={() => void onScan()}>
            <Text style={styles.sosTxt}>Scanner en tant que secours</Text>
          </Pressable>
          {scanMsg ? <Text style={styles.meta}>{scanMsg}</Text> : null}
        </Card>
        <Card title="Alerte pause conduite (4 h)">
          <Text style={styles.timer}>
            Chrono session : {Math.floor(seconds / 60)} min {seconds % 60} s
          </Text>
          {(pausedAlert || demoAlmost) && (
            <View style={styles.alert}>
              <Text style={styles.alertTxt}>
                {pausedAlert
                  ? '4 heures écoulées — faites une pause ou prenez un café.'
                  : 'Démo : pensez à vous reposer régulièrement (seuil 4 h).'}
              </Text>
            </View>
          )}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted },
  coords: { fontWeight: '700', color: colors.ink },
  row: { flexDirection: 'row', gap: 8 },
  sos: { flex: 1, backgroundColor: colors.danger, borderRadius: 10, padding: 12, alignItems: 'center' },
  share: { flex: 1, backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  sosTxt: { color: colors.white, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
  },
  timer: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  alert: { backgroundColor: colors.warnSoft, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.warn },
  alertTxt: { color: colors.ink, fontWeight: '700' },
});
