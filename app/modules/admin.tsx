import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { colors } from '../../src/theme/colors';

/** Module 17b — super-admin skeleton. */
export default function AdminScreen() {
  useModuleVisit(17);
  const [flags, setFlags] = useState({
    multiIa: false,
    obdLive: false,
    lydia: false,
    filVideo: true,
    gpsPl: true,
  });

  const toggle = (k: keyof typeof flags) => setFlags((f) => ({ ...f, [k]: !f[k] }));

  return (
    <>
      <Stack.Screen options={{ title: 'Super-admin' }} />
      <Screen title="Super-admin" subtitle="Module 17 — comptes · contenus · flags">
        <Card title="Analytics (mock)">
          <Text style={styles.kpi}>MAU 12 480 · sessions/j 3.2 · conversion Pro 4.1%</Text>
          <Text style={styles.meta}>Modules les + ouverts : Mon véhicule · Diagnostic · Garages</Text>
        </Card>
        <Card title="Comptes & modération">
          <Text style={styles.line}>• 3 signalements fil mécanique en file</Text>
          <Text style={styles.line}>• 1 garage Pro en attente KYC</Text>
          <Text style={styles.line}>• Ban / warn (actions locales stub)</Text>
        </Card>
        <Card title="Feature flags">
          {(Object.keys(flags) as (keyof typeof flags)[]).map((k) => (
            <Pressable key={k} style={styles.flag} onPress={() => toggle(k)}>
              <Text style={styles.flagName}>{k}</Text>
              <Text style={[styles.flagVal, flags[k] ? styles.on : styles.off]}>{flags[k] ? 'ON' : 'OFF'}</Text>
            </Pressable>
          ))}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  kpi: { fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  line: { color: colors.slate },
  flag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  flagName: { fontWeight: '700', color: colors.ink },
  flagVal: { fontWeight: '900', fontSize: 12 },
  on: { color: colors.garage },
  off: { color: colors.danger },
});
