import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useFleet } from '../../src/context/FleetContext';
import { CASCADE } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { colors } from '../../src/theme/colors';
import type { ContinentCode, Powertrain, VehicleClass, VehicleProfile } from '../../src/types/vehicle';

/** Module 2 — sélecteur cascade + multi-flotte. */
export default function FlotteScreen() {
  useModuleVisit(2);
  const { vehicles, active, setActive, upsertVehicle } = useFleet();
  const [continent, setContinent] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [powertrain, setPowertrain] = useState<string | null>(null);

  const countries = continent ? CASCADE.countries[continent] ?? [] : [];
  const makes = country ? CASCADE.makes[country] ?? [] : [];
  const models = make ? CASCADE.models[make] ?? [] : [];

  const preview = useMemo(() => {
    if (!make || !model || !year || !powertrain || !continent || !country) return null;
    return `${continent}/${country} → ${make} ${model} ${year} · ${powertrain}`;
  }, [continent, country, make, model, year, powertrain]);

  const saveCascade = () => {
    if (!preview || !make || !model || !year || !powertrain || !continent || !country) return;
    const v: VehicleProfile = {
      id: `cascade-${Date.now()}`,
      label: `${make} ${model}`,
      continent: continent as ContinentCode,
      country,
      make,
      model,
      year,
      powertrain: powertrain as Powertrain,
      vehicleClass: (powertrain.includes('poids') ? 'poids_lourd' : 'voiture') as VehicleClass,
      fluids: { engineOilL: 5, coolantL: 6, washerL: 3 },
      commonFailures: [{ id: 'c1', title: 'Usure standard (mock)', symptoms: ['données cascade'], severity: 'faible' }],
      odometerKm: 0,
      unitSystem: continent === 'NA' ? 'imperial' : 'metric',
      currency: country === 'CA' ? 'CAD' : country === 'US' ? 'USD' : country === 'AU' ? 'AUD' : 'EUR',
    };
    upsertVehicle(v);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Flotte & cascade' }} />
      <Screen title="Sélecteur cascade" subtitle="Module 2 — multi-flotte">
        <Card title="Véhicules enregistrés">
          {vehicles.map((v) => (
            <Pressable key={v.id} style={[styles.veh, active?.id === v.id && styles.vehOn]} onPress={() => setActive(v.id)}>
              <Text style={styles.vehTitle}>{v.label}</Text>
              <Text style={styles.vehSub}>{v.make} {v.model} · {v.year}</Text>
            </Pressable>
          ))}
        </Card>
        <Card title="Cascade visuelle">
          <ChipRow label="Continent" options={CASCADE.continents.map((c) => c.id)} value={continent} onChange={(v) => { setContinent(v); setCountry(null); setMake(null); setModel(null); }} />
          <ChipRow label="Pays" options={countries} value={country} onChange={(v) => { setCountry(v); setMake(null); setModel(null); }} />
          <ChipRow label="Marque" options={makes} value={make} onChange={(v) => { setMake(v); setModel(null); }} />
          <ChipRow label="Modèle" options={models} value={model} onChange={setModel} />
          <ChipRow label="Année" options={CASCADE.years.map(String)} value={year ? String(year) : null} onChange={(v) => setYear(Number(v))} />
          <ChipRow label="Motorisation" options={CASCADE.powertrains} value={powertrain} onChange={setPowertrain} />
          {preview ? <Text style={styles.preview}>Aperçu : {preview}</Text> : null}
          <Pressable style={styles.save} onPress={saveCascade} disabled={!preview}>
            <Text style={styles.saveTxt}>Enregistrer dans la flotte</Text>
          </Pressable>
        </Card>
      </Screen>
    </>
  );
}

function ChipRow({ label, options, value, onChange }: { label: string; options: string[]; value: string | null; onChange: (v: string) => void }) {
  if (!options.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Pressable key={o} style={[styles.chip, value === o && styles.chipOn]} onPress={() => onChange(o)}>
            <Text style={[styles.chipTxt, value === o && styles.chipTxtOn]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  veh: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.line, marginBottom: 6 },
  vehOn: { borderColor: colors.signal, backgroundColor: colors.signalSoft },
  vehTitle: { fontWeight: '800', color: colors.ink },
  vehSub: { color: colors.muted, fontSize: 12 },
  chipLabel: { fontWeight: '700', color: colors.ink, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.mist, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { color: colors.slate, fontSize: 12, fontWeight: '600' },
  chipTxtOn: { color: colors.white },
  preview: { color: colors.garage, fontWeight: '700' },
  save: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center', opacity: 1 },
  saveTxt: { color: colors.white, fontWeight: '800' },
});
