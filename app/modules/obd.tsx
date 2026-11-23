import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { readObdSnapshot } from '../../src/services/firebase';
import type { ObdProtocol, ObdReadingDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

/** Module 5 — OBD2 / J1939 wired to Firebase service + mock fallback. */
export default function ObdScreen() {
  useModuleVisit(5);
  const { profile } = useAuth();
  const { active } = useFleet();
  const [protocol, setProtocol] = useState<ObdProtocol>('OBD2');
  const [reading, setReading] = useState<ObdReadingDoc | null>(null);
  const [label, setLabel] = useState<string | undefined>();
  const [cleared, setCleared] = useState(false);

  const onRead = async () => {
    const res = await readObdSnapshot(profile?.uid ?? 'mock-local-user', active?.id ?? 'unknown', protocol);
    setReading(res.data);
    setLabel(res.stubLabel ?? (res.source === 'firebase' ? 'Lecture enregistrée Firestore' : undefined));
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Valise OBD' }} />
      <Screen title="Diagnostic OBD / PL" subtitle="Module 5 — Bluetooth / Wi-Fi / USB">
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : <StubBanner text="STUB OBD — valise physique non branchée" />}
        <Card title="Protocole">
          <View style={styles.row}>
            {(['OBD2', 'EOBD', 'J1939', 'J1708'] as ObdProtocol[]).map((p) => (
              <Pressable key={p} style={[styles.chip, protocol === p && styles.chipOn]} onPress={() => setProtocol(p)}>
                <Text style={[styles.chipTxt, protocol === p && styles.chipTxtOn]}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.btn} onPress={() => void onRead()}>
            <Text style={styles.btnTxt}>Lire snapshot (service)</Text>
          </Pressable>
        </Card>
        {reading ? (
          <Card title={`Codes défauts (${reading.source})`}>
            {reading.dtcCodes.map((d) => (
              <View key={d.code} style={styles.dtc}>
                <Text style={styles.code}>{d.code}</Text>
                <Text style={styles.plain}>{d.plainLanguage}</Text>
              </View>
            ))}
            <Text style={styles.meta}>
              Capteurs : {Object.entries(reading.sensors)
                .map(([k, v]) => `${k}=${v}`)
                .join(' · ')}
            </Text>
            <Pressable style={styles.clear} onPress={() => setCleared(true)}>
              <Text style={styles.btnTxt}>{cleared ? 'Voyants mock effacés' : 'Effacer voyants (stub)'}</Text>
            </Pressable>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.mist },
  chipOn: { backgroundColor: colors.asphalt },
  chipTxt: { fontWeight: '700', color: colors.slate, fontSize: 12 },
  chipTxtOn: { color: colors.white },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnTxt: { color: colors.white, fontWeight: '800' },
  dtc: { backgroundColor: colors.mist, borderRadius: 10, padding: 10, gap: 4 },
  code: { fontWeight: '900', color: colors.signal },
  plain: { color: colors.slate },
  meta: { color: colors.muted, fontSize: 12 },
  clear: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
});
