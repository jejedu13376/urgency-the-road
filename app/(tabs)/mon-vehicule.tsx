import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { Card } from '../../src/components/Card';
import { ProgressHero } from '../../src/components/ProgressHero';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useFleet } from '../../src/context/FleetContext';
import { mockDecodeVin } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { fr } from '../../src/i18n/fr';
import { stubVinDecodeLabel } from '../../src/services/stubs';
import { colors } from '../../src/theme/colors';

/** Module 1 — onglet obligatoire « Mon véhicule ». */
export default function MonVehiculeScreen() {
  useModuleVisit(1);
  const { active, upsertVehicle } = useFleet();
  const [vin, setVin] = useState(active?.vin ?? '');
  const [msg, setMsg] = useState<string | null>(null);

  const onDecode = () => {
    const decoded = mockDecodeVin(vin);
    if (!decoded) {
      setMsg('VIN trop court (mock local).');
      return;
    }
    upsertVehicle({ ...decoded, label: active?.label ?? decoded.label });
    setMsg(`Fiche mise à jour : ${decoded.make} ${decoded.model} ${decoded.year}`);
  };

  return (
    <Screen title={fr.tabMonVehicule} subtitle="Fiche technique & décodage VIN mondial (mock)">
      <ProgressHero />
      <StubBanner text={stubVinDecodeLabel()} />

      <Card title="Recherche par numéro de série (VIN)">
        <TextInput
          value={vin}
          onChangeText={setVin}
          autoCapitalize="characters"
          placeholder="Ex. VF1RJA00067000001"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable style={styles.primary} onPress={onDecode}>
            <Text style={styles.primaryTxt}>Décoder VIN</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => setMsg('STUB caméra — scan VIN non branché (expo-camera à brancher)')}
          >
            <Text style={styles.secondaryTxt}>Scan caméra</Text>
          </Pressable>
        </View>
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </Card>

      {active ? (
        <Card title="Fiche technique">
          <Text style={styles.line}>
            <Text style={styles.k}>Véhicule : </Text>
            {active.label}
          </Text>
          <Text style={styles.line}>
            <Text style={styles.k}>Marque / modèle : </Text>
            {active.make} {active.model} ({active.year})
          </Text>
          <Text style={styles.line}>
            <Text style={styles.k}>Motorisation : </Text>
            {active.powertrain} · {active.vehicleClass}
          </Text>
          <Text style={styles.line}>
            <Text style={styles.k}>Zone : </Text>
            {active.continent}/{active.country} · {active.currency} · {active.unitSystem}
          </Text>
          <Text style={styles.line}>
            <Text style={styles.k}>Fluides : </Text>
            huile {active.fluids.engineOilL} L · liquide refroid. {active.fluids.coolantL} L
          </Text>
          <Text style={styles.section}>Pannes fréquentes</Text>
          {active.commonFailures.map((f) => (
            <View key={f.id} style={styles.fail}>
              <Text style={styles.failTitle}>{f.title}</Text>
              <Text style={styles.failBody}>{f.symptoms.join(' · ')} — sévérité {f.severity}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Link href="/modules/flotte" asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkTxt}>Module 2 — sélecteur cascade & flotte →</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.mist,
  },
  row: { flexDirection: 'row', gap: 8 },
  primary: {
    flex: 1,
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryTxt: { color: colors.white, fontWeight: '800' },
  secondary: {
    flex: 1,
    backgroundColor: colors.mist,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryTxt: { color: colors.slate, fontWeight: '700' },
  msg: { color: colors.garage, fontSize: 13 },
  line: { color: colors.slate, fontSize: 14, lineHeight: 20 },
  k: { fontWeight: '700', color: colors.ink },
  section: { marginTop: 6, fontWeight: '800', color: colors.ink },
  fail: { backgroundColor: colors.signalSoft, borderRadius: 8, padding: 8 },
  failTitle: { fontWeight: '700', color: colors.ink },
  failBody: { color: colors.slate, fontSize: 12 },
  linkBtn: { paddingVertical: 12 },
  linkTxt: { color: colors.signal, fontWeight: '700' },
});
