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
const DEMO_LAT = 50.6292;
const DEMO_LON = 3.0573;

/** Module 13 — SOS, pause 4 h, fiche médicale, scan secours (KYC / abo). */
export default function UrgenceScreen() {
  useModuleVisit(13);
  const { profile } = useAuth();
  const [seconds, setSeconds] = useState(0);
  const [pausedAlert, setPausedAlert] = useState(false);
  const [driving, setDriving] = useState(true);
  const [card, setCard] = useState<MedicalCardDoc | null>(null);
  const [fullName, setFullName] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [scanCode, setScanCode] = useState('UM-DEMO-SCAN-001');
  const [badgeId, setBadgeId] = useState(profile?.rescuerBadgeId ?? '');
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [label, setLabel] = useState<string | undefined>();

  useEffect(() => {
    if (!driving) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [driving]);

  useEffect(() => {
    if (seconds >= FOUR_H) setPausedAlert(true);
  }, [seconds]);

  useEffect(() => {
    void (async () => {
      const res = await getOwnMedicalCard(profile?.uid ?? 'mock-local-user');
      setCard(res.data);
      setLabel(res.stubLabel);
      if (res.data) {
        setFullName(res.data.fullName);
        setBloodType(res.data.bloodType ?? '');
        setAllergies(res.data.allergies.join(', '));
        setConditions(res.data.conditions.join(', '));
        setMedications(res.data.medications.join(', '));
        setContactName(res.data.emergencyContacts[0]?.name ?? '');
        setContactPhone(res.data.emergencyContacts[0]?.phone ?? '');
        setScanCode(res.data.scanCode);
      }
    })();
  }, [profile?.uid]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const demoAlmost = seconds >= 10 && seconds < FOUR_H;

  const splitList = (v: string) =>
    v
      .split(/[,;]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const saveCard = async () => {
    const payload: MedicalCardDoc = {
      id: card?.id ?? `med-${profile?.uid ?? 'local'}`,
      ownerUid: profile?.uid ?? 'mock-local-user',
      scanCode: card?.scanCode ?? 'UM-DEMO-SCAN-001',
      fullName: fullName || profile?.displayName || 'Utilisateur',
      allergies: splitList(allergies),
      conditions: splitList(conditions),
      medications: splitList(medications),
      emergencyContacts:
        contactName || contactPhone
          ? [{ name: contactName || 'Contact', phone: contactPhone || '—' }]
          : card?.emergencyContacts ?? [],
      bloodType: bloodType || undefined,
      updatedAt: new Date().toISOString(),
    };
    const res = await upsertMedicalCard(payload);
    setCard(res.data);
    setLabel(res.stubLabel);
    setSaveMsg('Fiche enregistrée (service). Visible uniquement pour secours autorisés.');
  };

  const onScan = async () => {
    const rescuerProfile = profile
      ? {
          ...profile,
          rescuerBadgeId: badgeId || profile.rescuerBadgeId,
        }
      : null;
    if (!badgeId.trim() && profile?.role === 'rescuer') {
      setScanMsg('KYC secours : renseignez le badge / n° professionnel avant scan.');
      return;
    }
    if (!rescuerProfile || rescuerProfile.role !== 'rescuer' || !rescuerProfile.subscriptionActive) {
      setScanMsg(
        'Accès refusé — rôle secours + abonnement secours actif requis (anti-fraude). Badge KYC affiché pour les intervenants autorisés.',
      );
    }
    const res = await scanMedicalCardAsRescuer(scanCode, rescuerProfile);
    setScanMsg(
      res.stubLabel ??
        (res.data
          ? `Fiche : ${res.data.fullName} · groupe ${res.data.bloodType ?? '—'} · allergies ${
              res.data.allergies.join(', ') || '—'
            }`
          : 'Aucune fiche pour ce code'),
    );
  };

  const sharePosition = () =>
    void Share.share({
      message: `URGENCE MÉCANIQUE — Position approx. ${DEMO_LAT}, ${DEMO_LON} (Lille). Appelez les secours locaux. Code fiche : ${scanCode}.`,
    });

  return (
    <>
      <Stack.Screen options={{ title: 'Urgence' }} />
      <Screen title="Urgence & sécurité" subtitle="Module 13 — sauver des vies">
        <BackendStatusBanner />
        <StubBanner
          text={
            label ??
            'Fiche médicale confidentielle — scan réservé aux secours (rôle + abo actif + badge KYC)'
          }
        />

        <Card title="SOS Urgence médicale">
          <Text style={styles.meta}>
            Toujours accessible (bouton SOS flottant + cet écran). Appelle les services d’urgence locaux
            selon le pays (112 EU / équivalent).
          </Text>
          <Text style={styles.coords}>
            GPS mock : {DEMO_LAT.toFixed(4)}° N, {DEMO_LON.toFixed(4)}° E
          </Text>
          <Text style={styles.meta}>Adresse : Lille (démo) — à remplacer par géoloc live.</Text>
          <View style={styles.row}>
            <Pressable style={styles.sos} onPress={() => void Linking.openURL('tel:112')}>
              <Text style={styles.sosTxt}>Appeler 112</Text>
            </Pressable>
            <Pressable style={styles.share} onPress={sharePosition}>
              <Text style={styles.sosTxt}>SMS / partage</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.linkBtn}
            onPress={() => void Linking.openURL('https://www.croix-rouge.fr/je-me-forme/gestes-qui-sauvent')}
          >
            <Text style={styles.linkTxt}>Fiches premiers secours (hors ligne à brancher)</Text>
          </Pressable>
        </Card>

        <Card title="Fiche médicale personnelle">
          <Text style={styles.meta}>
            Antécédents, allergies, traitements, contacts — confidentiel. Ouverture réservée aux
            intervenants autorisés (scan type AirTag / QR).
          </Text>
          <Text style={styles.label}>Nom complet</Text>
          <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholderTextColor={colors.muted} placeholder="Nom" />
          <Text style={styles.label}>Groupe sanguin</Text>
          <TextInput value={bloodType} onChangeText={setBloodType} style={styles.input} placeholderTextColor={colors.muted} placeholder="ex. O+" />
          <Text style={styles.label}>Allergies (séparées par virgule)</Text>
          <TextInput value={allergies} onChangeText={setAllergies} style={styles.input} placeholderTextColor={colors.muted} placeholder="Pénicilline, …" />
          <Text style={styles.label}>Antécédents / conditions</Text>
          <TextInput value={conditions} onChangeText={setConditions} style={styles.input} placeholderTextColor={colors.muted} placeholder="Asthme, …" />
          <Text style={styles.label}>Traitements</Text>
          <TextInput value={medications} onChangeText={setMedications} style={styles.input} placeholderTextColor={colors.muted} placeholder="Médicaments…" />
          <Text style={styles.label}>Contact d’urgence</Text>
          <TextInput value={contactName} onChangeText={setContactName} style={styles.input} placeholderTextColor={colors.muted} placeholder="Nom du contact" />
          <TextInput value={contactPhone} onChangeText={setContactPhone} style={styles.input} placeholderTextColor={colors.muted} placeholder="+33…" keyboardType="phone-pad" />
          <Text style={styles.meta}>Code scan : {card?.scanCode ?? scanCode}</Text>
          <Pressable style={styles.btn} onPress={() => void saveCard()}>
            <Text style={styles.sosTxt}>Enregistrer la fiche</Text>
          </Pressable>
          {saveMsg ? <Text style={styles.ok}>{saveMsg}</Text> : null}
        </Card>

        <Card title="Scan secours — KYC & abonnement">
          <Text style={styles.meta}>
            Police / pompiers / ambulanciers : badge ou n° professionnel + abonnement secours actif
            obligatoires avant lecture de la fiche.
          </Text>
          <Text style={styles.kyc}>
            Profil : rôle {profile?.role ?? '—'} · abo {profile?.subscription ?? '—'} · actif{' '}
            {profile?.subscriptionActive ? 'oui' : 'non'}
          </Text>
          <Text style={styles.label}>Badge / n° professionnel (KYC)</Text>
          <TextInput
            value={badgeId}
            onChangeText={setBadgeId}
            style={styles.input}
            placeholder="ex. SP-59-4421"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>Code scan victime</Text>
          <TextInput
            value={scanCode}
            onChangeText={setScanCode}
            style={styles.input}
            placeholder="UM-…"
            placeholderTextColor={colors.muted}
          />
          <Pressable style={styles.share} onPress={() => void onScan()}>
            <Text style={styles.sosTxt}>Scanner en tant que secours</Text>
          </Pressable>
          {scanMsg ? <Text style={styles.meta}>{scanMsg}</Text> : null}
        </Card>

        <Card title="Alerte pause conduite (4 heures)">
          <Text style={styles.timer}>
            Chrono : {h} h {String(m).padStart(2, '0')} min {String(s).padStart(2, '0')} s
          </Text>
          <Text style={styles.meta}>Seuil réglementaire / sécurité : {FOUR_H / 3600} h de conduite continue.</Text>
          <View style={styles.row}>
            <Pressable
              style={styles.share}
              onPress={() => {
                setDriving((d) => !d);
              }}
            >
              <Text style={styles.sosTxt}>{driving ? 'Pause chrono' : 'Reprendre'}</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => {
                setSeconds(0);
                setPausedAlert(false);
              }}
            >
              <Text style={styles.sosTxt}>Réinitialiser</Text>
            </Pressable>
          </View>
          {(pausedAlert || demoAlmost) && (
            <View style={styles.alert}>
              <Text style={styles.alertTxt}>
                {pausedAlert
                  ? '4 heures écoulées — faites une pause ou prenez un café.'
                  : 'Démo : pensez à vous reposer régulièrement (alerte réelle à 4 h).'}
              </Text>
            </View>
          )}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12 },
  coords: { fontWeight: '700', color: colors.ink },
  label: { fontSize: 11, fontWeight: '700', color: colors.slate, marginTop: 6 },
  row: { flexDirection: 'row', gap: 8 },
  sos: { flex: 1, backgroundColor: colors.danger, borderRadius: 10, padding: 12, alignItems: 'center' },
  share: { flex: 1, backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  sosTxt: { color: colors.white, fontWeight: '800' },
  linkBtn: { paddingVertical: 8 },
  linkTxt: { color: colors.signal, fontWeight: '700', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
  },
  timer: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  alert: {
    backgroundColor: colors.warnSoft,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.warn,
    marginTop: 8,
  },
  alertTxt: { color: colors.ink, fontWeight: '700' },
  ok: { color: colors.garage, fontWeight: '700', marginTop: 6 },
  kyc: {
    backgroundColor: colors.mist,
    borderRadius: 8,
    padding: 8,
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
  },
});
