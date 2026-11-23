import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listPartsForVin, scanQuoteStub } from '../../src/services/firebase';
import type { PartDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

/** Module 3 — parts + quotes services. */
export default function PiecesScreen() {
  useModuleVisit(3);
  const { profile } = useAuth();
  const { active } = useFleet();
  const [parts, setParts] = useState<PartDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await listPartsForVin(active?.vin);
      setParts(res.data);
      setLabel(res.stubLabel);
    })();
  }, [active?.vin]);

  const totalPose = useMemo(
    () => parts.reduce((s, p) => s + p.priceAftermarket + p.laborHours * p.laborRate, 0),
    [parts],
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Pièces & devis' }} />
      <Screen title="Achats & devis" subtitle={`Module 3 · VIN ${active?.vin ?? '—'}`}>
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}
        <Card title="Liste auto (service)">
          {parts.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.meta}>{p.category} · OEM {p.oemSku}</Text>
              </View>
              <Text style={styles.price}>{p.priceAftermarket} {p.currency}</Text>
            </View>
          ))}
          <Text style={styles.total}>Estimation pièces + pose : {Math.round(totalPose)} EUR</Text>
        </Card>
        <Pressable
          style={styles.scan}
          onPress={() =>
            void scanQuoteStub(profile?.uid ?? 'mock-local-user').then((r) =>
              setScanMsg(`${r.data.scanLabel} · risque ${r.data.quote.overchargeRisk}`),
            )
          }
        >
          <Text style={styles.scanTxt}>Scanner devis garage (service stub)</Text>
        </Pressable>
        {scanMsg ? <Text style={styles.meta}>{scanMsg}</Text> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  name: { fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  price: { fontWeight: '800', color: colors.signal },
  total: { marginTop: 8, fontWeight: '800', color: colors.garage },
  scan: { backgroundColor: colors.asphalt, borderRadius: 12, padding: 14, alignItems: 'center' },
  scanTxt: { color: colors.white, fontWeight: '800' },
});
