import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listGaragesNearby, submitGarageRating } from '../../src/services/firebase';
import type { GarageDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

/** Module 9 */
export default function GaragesScreen() {
  useModuleVisit(9);
  const { profile } = useAuth();
  const [places, setPlaces] = useState<GarageDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await listGaragesNearby();
      setPlaces(res.data);
      setLabel(res.stubLabel);
    })();
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Garages GPS' }} />
      <Screen title="Autour de moi" subtitle="Module 9">
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}
        {places.map((p) => (
          <Card key={p.id} title={p.name}>
            <Text style={styles.kind}>{p.kind}</Text>
            <Text style={styles.line}>{p.address}</Text>
            <Text style={styles.line}>{p.hours} · ★ {p.ratingAvg ?? '—'}</Text>
            <Pressable style={styles.call} onPress={() => void Linking.openURL(`tel:${p.phone}`)}>
              <Text style={styles.callTxt}>Appeler {p.phone}</Text>
            </Pressable>
            <Pressable
              style={styles.rate}
              onPress={() =>
                void submitGarageRating({
                  garageId: p.id,
                  authorUid: profile?.uid ?? 'mock-local-user',
                  stars: 5,
                  comment: 'Bon accueil (demo)',
                }).then((r) => setMsg(r.stubLabel ?? 'Note envoyée'))
              }
            >
              <Text style={styles.callTxt}>Noter 5★</Text>
            </Pressable>
          </Card>
        ))}
        {msg ? <Text style={styles.line}>{msg}</Text> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  kind: { color: colors.signal, fontWeight: '800', fontSize: 12 },
  line: { color: colors.slate },
  call: { backgroundColor: colors.garage, borderRadius: 10, padding: 10, alignItems: 'center' },
  rate: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 10, alignItems: 'center' },
  callTxt: { color: colors.white, fontWeight: '800' },
});
