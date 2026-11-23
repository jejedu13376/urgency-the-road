import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useFleet } from '../../src/context/FleetContext';
import { CASCADE } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { colors } from '../../src/theme/colors';
import type { ContinentCode, Powertrain, VehicleClass, VehicleProfile } from '../../src/types/vehicle';

const CASCADE_FAILURES: Record<string, { id: string; title: string; symptoms: string[]; severity: 'faible' | 'moyen' | 'eleve' }[]> = {
  'Renault|Clio V': [
    { id: 'c-clio-1', title: 'Capteur PMH intermittent', symptoms: ['calage à chaud', 'voyant moteur'], severity: 'moyen' },
    { id: 'c-clio-2', title: 'Usure plaquettes avant', symptoms: ['bruit freinage', 'course pédale'], severity: 'faible' },
    { id: 'c-clio-3', title: 'Van EGR encrassée', symptoms: ['perte de puissance', 'fumée noire'], severity: 'moyen' },
  ],
  'Renault|Master': [
    { id: 'c-mas-1', title: 'Turbo variable grippé', symptoms: ['manque en charge', 'sifflement'], severity: 'eleve' },
  ],
  'Ford|F-150': [
    { id: 'c-f150-1', title: 'Camphaser AAC', symptoms: ['cliquetis démarrage', 'ralenti irrégulier'], severity: 'eleve' },
    { id: 'c-f150-2', title: 'Bobine crayon #4', symptoms: ['ratés', 'consommation↑'], severity: 'moyen' },
  ],
  'Ford|F-350': [
    { id: 'c-f350-1', title: 'Filtre FAP / DPF saturé', symptoms: ['mode dégradé', 'régénération fréquente'], severity: 'eleve' },
  ],
  'Mercedes-Benz|Actros 1845': [
    { id: 'c-act-1', title: 'Capteur NOx amont', symptoms: ['mode dégradé', 'AdBlue↑'], severity: 'eleve' },
    { id: 'c-act-2', title: 'Compresseur air', symptoms: ['pression circuit↓', 'frein de secours'], severity: 'eleve' },
  ],
  'Toyota|Hilux': [
    { id: 'c-hil-1', title: 'Injecteur diesel fuyard', symptoms: ['ralenti irrégulier', 'odeur gasoil'], severity: 'moyen' },
  ],
  'Peugeot|208': [
    { id: 'c-208-1', title: 'Chaîne de distribution PureTech', symptoms: ['bruit froid', 'voyant huile'], severity: 'eleve' },
  ],
  'Iveco|S-Way': [
    { id: 'c-iv-1', title: 'Capteur différentiel FAP', symptoms: ['voyant moteur', 'couple limité'], severity: 'moyen' },
  ],
};

const COUNTRY_LABEL: Record<string, string> = {
  FR: 'France', DE: 'Allemagne', ES: 'Espagne', IT: 'Italie', BE: 'Belgique',
  CA: 'Canada', US: 'États-Unis', AU: 'Australie', JP: 'Japon', KR: 'Corée', CN: 'Chine',
};

const POWER_LABEL: Record<string, string> = {
  essence: 'Essence', diesel: 'Diesel', hybride: 'Hybride', electrique: 'Électrique',
  gpl: 'GPL', poids_lourd_diesel: 'Diesel poids lourd',
};

const CLASS_LABEL: Record<VehicleClass, string> = {
  voiture: 'Voiture',
  suv: 'SUV',
  pickup: 'Pick-up',
  poids_lourd: 'Poids lourd',
};

/** Module 2 — sélecteur cascade + multi-flotte. */
export default function FlotteScreen() {
  useModuleVisit(2);
  const { vehicles, active, setActive, upsertVehicle, removeVehicle, syncSource, syncLabel, refreshCloud } =
    useFleet();
  const [continent, setContinent] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [powertrain, setPowertrain] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [odometer, setOdometer] = useState('0');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(true);

  const countries = continent ? CASCADE.countries[continent] ?? [] : [];
  const makes = country ? CASCADE.makes[country] ?? [] : [];
  const models = make ? CASCADE.models[make] ?? [] : [];

  const stepIndex = !continent
    ? 0
    : !country
      ? 1
      : !make
        ? 2
        : !model
          ? 3
          : !year
            ? 4
            : !powertrain
              ? 5
              : 6;

  const stepLabels = ['Continent', 'Pays', 'Marque', 'Modèle', 'Année', 'Motorisation', 'Pannes'];

  const failures = useMemo(() => {
    if (!make || !model) return [];
    return CASCADE_FAILURES[`${make}|${model}`] ?? [
      { id: 'c-gen', title: 'Usure standard (mock)', symptoms: ['données cascade'], severity: 'faible' as const },
    ];
  }, [make, model]);

  const preview = useMemo(() => {
    if (!make || !model || !year || !powertrain || !continent || !country) return null;
    const contLabel = CASCADE.continents.find((c) => c.id === continent)?.label ?? continent;
    return `${contLabel} / ${country} → ${make} ${model} ${year} · ${powertrain}`;
  }, [continent, country, make, model, year, powertrain]);

  const resetCascade = () => {
    setContinent(null);
    setCountry(null);
    setMake(null);
    setModel(null);
    setYear(null);
    setPowertrain(null);
    setCustomLabel('');
    setOdometer('0');
    setSavedMsg(null);
  };

  const saveCascade = () => {
    if (!preview || !make || !model || !year || !powertrain || !continent || !country) return;
    const isPl = powertrain.includes('poids') || /Actros|Master|F-350/i.test(model);
    const v: VehicleProfile = {
      id: `cascade-${Date.now()}`,
      label: customLabel.trim() || `${make} ${model}`,
      continent: continent as ContinentCode,
      country,
      make,
      model,
      year,
      powertrain: powertrain as Powertrain,
      vehicleClass: (isPl ? 'poids_lourd' : /F-150|Hilux/i.test(model) ? 'pickup' : 'voiture') as VehicleClass,
      fluids: { engineOilL: isPl ? 28 : 5, coolantL: isPl ? 40 : 6, washerL: isPl ? 10 : 3 },
      commonFailures: failures,
      odometerKm: Math.max(0, Number(odometer) || 0),
      unitSystem: continent === 'NA' ? 'imperial' : 'metric',
      currency: country === 'CA' ? 'CAD' : country === 'US' ? 'USD' : country === 'AU' ? 'AUD' : 'EUR',
    };
    upsertVehicle(v);
    setSavedMsg(`${v.label} ajouté et activé — basculez en 1 clic ci-dessus.`);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Flotte & cascade' }} />
      <Screen title="Sélecteur cascade" subtitle="Module 2 — multi-flotte · Continent → pannes">
        <Card title={`Véhicules enregistrés (${vehicles.length})`}>
          <Text style={styles.hint}>
            Activez un véhicule en 1 clic (perso, pick-up, PL). Le véhicule actif alimente VIN / pièces / GPS.
          </Text>
          <View style={styles.syncRow}>
            <Text style={styles.syncBadge}>
              {syncSource === 'firestore' ? 'CLOUD' : syncSource === 'pending' ? 'SYNC…' : 'LOCAL'}
            </Text>
            <Text style={styles.hint}>{syncLabel ?? '—'}</Text>
          </View>
          <Pressable style={styles.refreshCloud} onPress={() => void refreshCloud()}>
            <Text style={styles.refreshCloudTxt}>Rafraîchir flotte cloud</Text>
          </Pressable>
          {vehicles.map((v) => {
            const on = active?.id === v.id;
            return (
              <View key={v.id} style={[styles.veh, on && styles.vehOn]}>
                <Pressable style={{ flex: 1 }} onPress={() => setActive(v.id)}>
                  <View style={styles.vehHead}>
                    <Text style={styles.vehTitle}>{v.label}</Text>
                    <Text style={[styles.badge, on && styles.badgeOn]}>{on ? 'ACTIF' : CLASS_LABEL[v.vehicleClass]}</Text>
                  </View>
                  <Text style={styles.vehSub}>
                    {v.make} {v.model} · {v.year} · {v.powertrain}
                    {v.vin ? ` · VIN ${v.vin}` : ''}
                  </Text>
                  <Text style={styles.vehSub}>
                    {v.continent}/{v.country} · {v.currency} · {v.odometerKm} km
                  </Text>
                </Pressable>
                {!on ? (
                  <Pressable onPress={() => setActive(v.id)} style={styles.switchBtn}>
                    <Text style={styles.switchTxt}>Basculer</Text>
                  </Pressable>
                ) : null}
                {vehicles.length > 1 ? (
                  <Pressable
                    onPress={() => removeVehicle(v.id)}
                    style={styles.removeBtn}
                    accessibilityLabel={`Retirer ${v.label}`}
                  >
                    <Text style={styles.removeTxt}>Retirer</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          <Pressable
            style={{
              marginTop: 8,
              backgroundColor: colors.mist,
              borderRadius: 10,
              padding: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.line,
            }}
            onPress={() => setAddOpen((o) => !o)}
          >
            <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 13 }}>
              {addOpen ? 'Masquer le sélecteur' : '+ Ajouter un véhicule (cascade)'}
            </Text>
          </Pressable>
        </Card>

        {addOpen ? (
        <Card title="Cascade visuelle (sans VIN)">
          <View style={styles.steps}>
            {stepLabels.map((label, i) => (
              <View key={label} style={[styles.stepDot, i <= stepIndex && styles.stepDotOn]}>
                <Text style={[styles.stepTxt, i <= stepIndex && styles.stepTxtOn]}>{i + 1}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.stepCaption}>
            Étape {Math.min(stepIndex + 1, 7)}/7 — {stepLabels[Math.min(stepIndex, 6)]}
          </Text>

          <ChipRow
            label="Continent / région"
            options={CASCADE.continents.map((c) => c.id)}
            labels={Object.fromEntries(CASCADE.continents.map((c) => [c.id, c.label]))}
            value={continent}
            onChange={(v) => {
              setContinent(v);
              setCountry(null);
              setMake(null);
              setModel(null);
              setYear(null);
              setPowertrain(null);
            }}
          />
          <ChipRow
            label="Pays"
            options={countries}
            labels={COUNTRY_LABEL}
            value={country}
            onChange={(v) => {
              setCountry(v);
              setMake(null);
              setModel(null);
              setYear(null);
              setPowertrain(null);
            }}
          />
          <ChipRow
            label="Marque"
            options={makes}
            value={make}
            onChange={(v) => {
              setMake(v);
              setModel(null);
              setYear(null);
              setPowertrain(null);
            }}
          />
          <ChipRow
            label="Modèle"
            options={models}
            value={model}
            onChange={(v) => {
              setModel(v);
              setYear(null);
              setPowertrain(null);
            }}
          />
          <ChipRow
            label="Année"
            options={CASCADE.years.map(String)}
            value={year ? String(year) : null}
            onChange={(v) => {
              setYear(Number(v));
              setPowertrain(null);
            }}
          />
          <ChipRow label="Motorisation" options={CASCADE.powertrains} labels={POWER_LABEL} value={powertrain} onChange={setPowertrain} />

          {preview ? (
            <View style={styles.previewBox}>
              <Text style={styles.preview}>Aperçu : {preview}</Text>
              <Text style={styles.hint}>Pannes fréquentes connues sur ce modèle :</Text>
              {failures.map((f) => (
                <Text key={f.id} style={styles.failLine}>
                  · {f.title} ({f.severity}) — {f.symptoms.join(', ')}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>Choisissez Continent → Pays → Marque → Modèle → Année → Motorisation.</Text>
          )}

          {preview ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.chipLabel}>Libellé flotte (optionnel)</Text>
              <TextInput
                value={customLabel}
                onChangeText={setCustomLabel}
                placeholder={`${make} ${model}`}
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.chipLabel}>Kilométrage</Text>
              <TextInput
                value={odometer}
                onChangeText={setOdometer}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
          ) : null}

          <Pressable style={[styles.save, !preview && styles.saveDisabled]} onPress={saveCascade} disabled={!preview}>
            <Text style={styles.saveTxt}>Enregistrer dans la flotte</Text>
          </Pressable>
          <Pressable style={styles.reset} onPress={resetCascade}>
            <Text style={styles.resetTxt}>Réinitialiser la cascade</Text>
          </Pressable>
          {savedMsg ? <Text style={styles.ok}>{savedMsg}</Text> : null}
        </Card>
        ) : null}

        <Card title="Suite du parcours">
          <Text style={styles.hint}>Après sélection : fiche véhicule, liste d’achats VIN, diagnostic.</Text>
          <Link href="/(tabs)/mon-vehicule" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkTxt}>Mon véhicule →</Text>
            </Pressable>
          </Link>
          <Link href="/modules/pieces" asChild>
            <Pressable style={styles.linkBtnAlt}>
              <Text style={styles.linkTxt}>Liste d’achats / devis (M3) →</Text>
            </Pressable>
          </Link>
        </Card>
      </Screen>
    </>
  );
}

function ChipRow({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  labels?: Record<string, string>;
  value: string | null;
  onChange: (v: string) => void;
}) {
  if (!options.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Pressable key={o} style={[styles.chip, value === o && styles.chipOn]} onPress={() => onChange(o)}>
            <Text style={[styles.chipTxt, value === o && styles.chipTxtOn]}>{labels?.[o] ?? o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  syncBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
    backgroundColor: colors.asphalt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  refreshCloud: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.mist,
    marginBottom: 8,
  },
  refreshCloudTxt: { color: colors.ink, fontWeight: '700', fontSize: 11 },
  veh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 6,
    backgroundColor: colors.paper,
  },
  vehOn: { borderColor: colors.signal, backgroundColor: colors.signalSoft },
  vehHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  vehTitle: { fontWeight: '800', color: colors.ink },
  vehSub: { color: colors.muted, fontSize: 12 },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.slate,
    backgroundColor: colors.mist,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgeOn: { color: colors.white, backgroundColor: colors.signal },
  switchBtn: { backgroundColor: colors.asphalt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  switchTxt: { color: colors.white, fontWeight: '700', fontSize: 11 },
  removeBtn: { paddingHorizontal: 6, paddingVertical: 8 },
  removeTxt: { color: colors.danger, fontWeight: '700', fontSize: 11 },
  steps: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  stepDotOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  stepTxt: { fontSize: 11, fontWeight: '800', color: colors.muted },
  stepTxtOn: { color: colors.white },
  stepCaption: { fontWeight: '700', color: colors.ink, fontSize: 12 },
  chipLabel: { fontWeight: '700', color: colors.ink, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { color: colors.slate, fontSize: 12, fontWeight: '600' },
  chipTxtOn: { color: colors.white },
  previewBox: { gap: 4, backgroundColor: colors.garageSoft, padding: 10, borderRadius: 10 },
  preview: { color: colors.garage, fontWeight: '700' },
  failLine: { color: colors.slate, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    color: colors.ink,
    backgroundColor: colors.mist,
  },
  save: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  saveDisabled: { opacity: 0.45 },
  saveTxt: { color: colors.white, fontWeight: '800' },
  reset: { alignItems: 'center', padding: 8 },
  resetTxt: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  ok: { color: colors.garage, fontWeight: '700', fontSize: 12 },
  linkBtn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  linkBtnAlt: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  linkTxt: { color: colors.white, fontWeight: '800' },
});
