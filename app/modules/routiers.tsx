import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { MOCK_PLACES } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listWeighStations } from '../../src/services/firebase';
import type { WeighStationDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

/** Module 8 */
export default function RoutiersScreen() {
  useModuleVisit(8);
  const [stations, setStations] = useState<WeighStationDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const depots = MOCK_PLACES.filter((p) => p.kind === 'depot_pl');

  useEffect(() => {
    void (async () => {
      const res = await listWeighStations();
      setStations(res.data);
      setLabel(res.stubLabel);
    })();
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Routiers' }} />
      <Screen title="Module routiers" subtitle="Module 8 — pesage & dépôts">
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}
        <Card title="Balances (allumées / ouvertes)">
          {stations.map((w) => (
            <View key={w.id} style={styles.row}>
              <Text style={styles.name}>{w.name}</Text>
              <Text style={styles.meta}>
                {w.litUp && w.status === 'open' ? '🟢 ALLUMÉE / OUVERTE' : '⚫ fermée / éteinte'} · {w.region}
              </Text>
              <Text style={styles.meta}>
                H max {w.heightLimitM ?? '—'} m · Poids {w.weightLimitT ?? '—'} t · {w.address}
              </Text>
            </View>
          ))}
        </Card>
        <Card title="Dépôts pièces PL">
          {depots.map((d) => (
            <View key={d.id} style={styles.row}>
              <Text style={styles.name}>{d.name}</Text>
              <Text style={styles.meta}>{d.hours} · {d.distanceKm} km · {d.phone}</Text>
            </View>
          ))}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
});
