import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useFleet } from '../../src/context/FleetContext';
import { MOCK_MAINTENANCE } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { colors } from '../../src/theme/colors';

/** Module 10 — entretien prédictif & carnet. */
export default function EntretienScreen() {
  useModuleVisit(10);
  const { active } = useFleet();
  const [items, setItems] = useState(MOCK_MAINTENANCE);
  const [exported, setExported] = useState(false);

  return (
    <>
      <Stack.Screen options={{ title: 'Entretien' }} />
      <Screen title="Entretien & carnet" subtitle={`Module 10 · ${active?.odometerKm ?? 0} km`}>
        <StubBanner text="STUB — export PDF certifié local simulé ; rappels pays mock" />
        <Card title="Maintenance automatique">
          {items.map((m) => (
            <Pressable
              key={m.id}
              style={styles.row}
              onPress={() =>
                setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: 'fait' } : x)))
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.title}</Text>
                <Text style={styles.meta}>
                  Échéance {m.dueKm} km{m.dueDateIso ? ` · ${m.dueDateIso}` : ''}
                </Text>
              </View>
              <Text style={styles.status}>{m.status}</Text>
            </Pressable>
          ))}
        </Card>
        <Card title="Rappels admin localisés">
          <Text style={styles.meta}>FR : contrôle technique · CA/US : plaques / assurance · AU : rego (mock)</Text>
          <Text style={styles.meta}>Batterie mock : 12.6 V — OK</Text>
        </Card>
        <Pressable style={styles.export} onPress={() => setExported(true)}>
          <Text style={styles.exportTxt}>{exported ? 'PDF mock généré ✓' : 'Exporter carnet PDF'}</Text>
        </Pressable>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  status: { fontWeight: '800', color: colors.signal, textTransform: 'uppercase', fontSize: 11 },
  export: { backgroundColor: colors.asphalt, borderRadius: 12, padding: 14, alignItems: 'center' },
  exportTxt: { color: colors.white, fontWeight: '800' },
});
