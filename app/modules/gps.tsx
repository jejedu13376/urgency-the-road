import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { getGpsPrefs, listRoadHazards, reportHazard, saveGpsPrefs } from '../../src/services/firebase';
import type { RoadHazardDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

/** Module 7 — double GPS + hazards. */
export default function GpsScreen() {
  useModuleVisit(7);
  const { profile } = useAuth();
  const [mode, setMode] = useState<'voiture' | 'camion'>('voiture');
  const [dest, setDest] = useState('Gare Lille Flandres');
  const [hazards, setHazards] = useState<RoadHazardDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const uid = profile?.uid ?? 'mock-local-user';
      const prefs = await getGpsPrefs(uid);
      setMode(prefs.data.mode);
      setLabel(prefs.stubLabel);
      const hz = await listRoadHazards();
      setHazards(hz.data);
    })();
  }, [profile?.uid]);

  const open = (app: 'google' | 'waze' | 'apple') => {
    const q = encodeURIComponent(dest);
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
      waze: `https://waze.com/ul?q=${q}&navigate=yes`,
      apple: `http://maps.apple.com/?daddr=${q}`,
    };
    void Linking.openURL(urls[app]);
  };

  const persistMode = (m: 'voiture' | 'camion') => {
    setMode(m);
    const uid = profile?.uid ?? 'mock-local-user';
    void saveGpsPrefs({
      id: uid,
      ownerUid: uid,
      mode: m,
      truckHeightM: 4,
      truckWidthM: 2.55,
      truckPtacT: 40,
      hazmat: false,
      preferApps: ['google', 'waze', 'apple'],
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Double GPS' }} />
      <Screen title="Navigation" subtitle="Module 7 — PL & voiture">
        <BackendStatusBanner />
        <StubBanner text={label ?? 'STUB GPS — pas de graphe ponts/PTAC live ; transfert apps réel'} />
        <Card title="Mode">
          <View style={styles.row}>
            <Pressable style={[styles.mode, mode === 'voiture' && styles.on]} onPress={() => persistMode('voiture')}>
              <Text style={styles.modeTxt}>Voiture normale</Text>
            </Pressable>
            <Pressable style={[styles.mode, mode === 'camion' && styles.on]} onPress={() => persistMode('camion')}>
              <Text style={styles.modeTxt}>Poids lourd</Text>
            </Pressable>
          </View>
          {mode === 'camion' ? (
            <Text style={styles.hint}>
              Contraintes mock : hauteur 4,0 m · PTAC 40 t · largeur 2,55 m · ADR off · interdictions PL EU/NA/AU
            </Text>
          ) : (
            <Text style={styles.hint}>Itinéraire rapide standard (mock ETA 18 min).</Text>
          )}
        </Card>
        <Card title="Destination">
          <TextInput value={dest} onChangeText={setDest} style={styles.input} placeholderTextColor={colors.muted} />
          <Text style={styles.section}>Envoyer la trajectoire</Text>
          <View style={styles.row}>
            <Pressable style={styles.send} onPress={() => open('google')}>
              <Text style={styles.sendTxt}>Google Maps</Text>
            </Pressable>
            <Pressable style={styles.send} onPress={() => open('waze')}>
              <Text style={styles.sendTxt}>Waze</Text>
            </Pressable>
            <Pressable style={styles.send} onPress={() => open('apple')}>
              <Text style={styles.sendTxt}>Apple Plans</Text>
            </Pressable>
          </View>
        </Card>
        <Card title="Signalements routiers">
          {hazards.map((h) => (
            <Text key={h.id} style={styles.hint}>
              {h.kind} · {h.note ?? ''} ({h.lat.toFixed(2)}, {h.lon.toFixed(2)})
            </Text>
          ))}
          <Pressable
            style={styles.send}
            onPress={() =>
              void reportHazard({
                reporterUid: profile?.uid ?? 'mock-local-user',
                kind: 'danger',
                lat: 50.63,
                lon: 3.06,
                note: 'Signalement démo',
              }).then((r) => setHazards((prev) => [r.data, ...prev]))
            }
          >
            <Text style={styles.sendTxt}>Signaler un danger (service)</Text>
          </Pressable>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mode: { flex: 1, minWidth: 120, padding: 12, borderRadius: 10, backgroundColor: colors.mist, alignItems: 'center' },
  on: { backgroundColor: colors.signalSoft, borderWidth: 1, borderColor: colors.signal },
  modeTxt: { fontWeight: '800', color: colors.ink },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, backgroundColor: colors.mist, color: colors.ink },
  section: { fontWeight: '800', color: colors.ink },
  send: { backgroundColor: colors.asphalt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  sendTxt: { color: colors.white, fontWeight: '700', fontSize: 12 },
});
