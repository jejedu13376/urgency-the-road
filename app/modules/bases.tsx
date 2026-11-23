import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { stubOtaSync } from '../../src/services/stubs';
import { colors } from '../../src/theme/colors';

/** Module 14 — bases auto-évolutives & OTA. */
export default function BasesScreen() {
  useModuleVisit(14);
  const [sync, setSync] = useState<ReturnType<typeof stubOtaSync> | null>(null);
  const [log] = useState([
    { id: 1, title: 'Fuite joint collecteur Clio V', source: 'multi-IA mock' },
    { id: 2, title: 'NOx FMI2 Actros', source: 'web TSB mock' },
    { id: 3, title: 'Camphaser F-150 cold start', source: 'recall mock' },
  ]);

  return (
    <>
      <Stack.Screen options={{ title: 'Bases & OTA' }} />
      <Screen title="Bases évolutives" subtitle="Module 14">
        <StubBanner text="STUB — apprentissage cloud & OTA non branchés" />
        <Card title="Auto-apprentissage des pannes">
          {log.map((l) => (
            <View key={l.id} style={styles.row}>
              <Text style={styles.title}>{l.title}</Text>
              <Text style={styles.meta}>Source : {l.source}</Text>
            </View>
          ))}
        </Card>
        <Pressable style={styles.btn} onPress={() => setSync(stubOtaSync())}>
          <Text style={styles.btnTxt}>Synchroniser OTA (stub)</Text>
        </Pressable>
        {sync ? (
          <Card title="Dernière sync">
            <StubBanner text={sync.label} />
            <Text style={styles.meta}>
              {sync.data.lastSync} · {sync.data.learnedFailures} pannes enrichies (mock)
            </Text>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  btn: { backgroundColor: colors.signal, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnTxt: { color: colors.white, fontWeight: '800' },
});
