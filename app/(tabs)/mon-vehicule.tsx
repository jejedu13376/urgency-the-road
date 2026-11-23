import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { ProgressHero } from '../../src/components/ProgressHero';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { VinCameraScanner } from '../../src/components/VinCameraScanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { MOCK_MAINTENANCE } from '../../src/data/mocks';
import { fr } from '../../src/i18n/fr';
import { decodeVinRemote } from '../../src/services/firebase';
import { fetchRecallsByVehicle, type RecallHit } from '../../src/services/recalls/nhtsaRecalls';
import { colors } from '../../src/theme/colors';
import type { VehicleProfile } from '../../src/types/vehicle';

const POWERTRAIN_FR: Record<string, string> = {
  essence: 'Essence',
  diesel: 'Diesel',
  hybride: 'Hybride',
  electrique: 'Électrique',
  gpl: 'GPL',
  poids_lourd_diesel: 'Diesel poids lourd',
};

const CLASS_FR: Record<string, string> = {
  voiture: 'Voiture',
  suv: 'SUV',
  pickup: 'Pick-up',
  poids_lourd: 'Poids lourd',
};

const CONTINENT_FR: Record<string, string> = {
  EU: 'Europe',
  NA: 'Amérique du Nord',
  AU: 'Australie',
  AS: 'Asie',
};

const SEV_FR: Record<string, string> = {
  faible: 'faible',
  moyen: 'moyen',
  eleve: 'élevé',
};

/** Module 1 — onglet obligatoire « Mon véhicule » (CDC). */
export default function MonVehiculeScreen() {
  useModuleVisit(1);
  const { profile } = useAuth();
  const { active, vehicles, setActive, upsertVehicle, syncLabel, syncSource } = useFleet();
  const [vin, setVin] = useState(active?.vin ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sourceLabel, setSourceLabel] = useState<string | undefined>();
  const [recalls, setRecalls] = useState<RecallHit[]>([]);
  const [recallLabel, setRecallLabel] = useState<string | null>(null);
  const [recallsLoading, setRecallsLoading] = useState(false);
  const [odoDraft, setOdoDraft] = useState(active ? String(active.odometerKm) : '');

  useEffect(() => {
    if (active?.vin) setVin(active.vin);
    if (active) setOdoDraft(String(active.odometerKm));
  }, [active?.id, active?.vin, active?.odometerKm]);

  useEffect(() => {
    if (!active?.make || !active?.model || !active?.year) {
      setRecalls([]);
      setRecallLabel(null);
      setRecallsLoading(false);
      return;
    }
    let cancelled = false;
    setRecalls([]);
    setRecallLabel(null);
    setRecallsLoading(true);
    void (async () => {
      const res = await fetchRecallsByVehicle({
        make: active.make,
        model: active.model,
        year: active.year,
      });
      if (cancelled) return;
      setRecalls(res.items);
      setRecallLabel(res.label);
      setRecallsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [active?.make, active?.model, active?.year]);

  const applyDecoded = async (decoded: VehicleProfile, stub?: string) => {
    const sameVin = Boolean(active && active.vin && active.vin === decoded.vin);
    const merged: VehicleProfile = {
      ...decoded,
      label: sameVin && active?.label ? active.label : decoded.label,
      odometerKm: sameVin && active ? active.odometerKm : decoded.odometerKm,
    };
    // FleetContext syncs to Firestore when Auth — avoid double addDoc for cascade-/decoded- ids
    upsertVehicle(merged);
    setSourceLabel(
      stub ??
        syncLabel ??
        (profile?.uid
          ? syncSource === 'firestore'
            ? 'Firestore via flotte'
            : 'Sync flotte…'
          : 'Local — connectez-vous pour sync Firestore'),
    );
    setMsg(
      profile?.uid
        ? `Fiche enregistrée : ${merged.make} ${merged.model} ${merged.year}`
        : `Fiche locale : ${merged.make} ${merged.model} ${merged.year}`,
    );
  };

  const onDecode = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await decodeVinRemote(vin);
      setSourceLabel(res.stubLabel);
      if (!res.data) {
        setMsg(res.stubLabel ?? 'VIN trop court ou non reconnu. Saisissez au moins 11 caractères.');
        return;
      }
      await applyDecoded(res.data, res.stubLabel);
    } finally {
      setBusy(false);
    }
  };

  const onVinFromCamera = async (scanned: string) => {
    setVin(scanned);
    setBusy(true);
    setMsg(null);
    try {
      const res = await decodeVinRemote(scanned);
      setSourceLabel(res.stubLabel ?? 'Scan caméra + NHTSA');
      if (res.data) await applyDecoded(res.data, res.stubLabel ?? 'Scan caméra + NHTSA');
      else setMsg(res.stubLabel ?? 'VIN scanné non décodé');
    } finally {
      setBusy(false);
    }
  };

  const saveOdometer = () => {
    if (!active) return;
    const n = parseInt(odoDraft.replace(/\s/g, ''), 10);
    if (!Number.isFinite(n) || n < 0) {
      setMsg('Kilométrage invalide');
      return;
    }
    const next = { ...active, odometerKm: n };
    // FleetContext syncs Firestore when Auth — no direct upsertVehicleRemote
    upsertVehicle(next);
    setMsg(
      profile?.uid
        ? `Kilométrage sync flotte : ${n.toLocaleString('fr-FR')} km`
        : `Kilométrage local : ${n.toLocaleString('fr-FR')} km`,
    );
  };

  return (
    <Screen
      title={fr.tabMonVehicule}
      subtitle="Module 1 — décodage VIN mondial & fiche technique"
    >
      <BackendStatusBanner />
      <ProgressHero />
      <StubBanner
        text={
          sourceLabel ??
          'VIN : NHTSA vPIC live · fallback WMI · fluides locaux · recalls NHTSA · pas d’API fluides OEM.'
        }
      />
      <VinCameraScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onVin={(v) => void onVinFromCamera(v)}
      />

      <Card title="Recherche mondiale par numéro de série (VIN)">
        <Text style={styles.hint}>
          Europe · Amérique du Nord · Australie · Asie — voitures, pick-up et poids lourds.
        </Text>
        <TextInput
          value={vin}
          onChangeText={setVin}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Saisie manuelle du VIN (ex. VF1RJA00067000001)"
          placeholderTextColor={colors.muted}
          style={styles.input}
          accessibilityLabel="Numéro de série VIN"
        />
        <View style={styles.row}>
          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            onPress={() => void onDecode()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Décoder VIN"
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryTxt}>Décoder VIN</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.secondary, busy && styles.disabled]}
            onPress={() => setScannerOpen(true)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Scanner le VIN avec la caméra"
          >
            <Text style={styles.secondaryTxt}>Scan caméra</Text>
          </Pressable>
        </View>
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </Card>

      {active ? (
        <Card title="Fiche technique complète">
          <Field label="Libellé" value={active.label} />
          <Field label="VIN" value={active.vin ?? '—'} />
          <Field label="Marque" value={active.make} />
          <Field label="Modèle" value={active.model} />
          <Field label="Année" value={String(active.year)} />
          <Field
            label="Motorisation"
            value={`${POWERTRAIN_FR[active.powertrain] ?? active.powertrain} · ${CLASS_FR[active.vehicleClass] ?? active.vehicleClass}`}
          />
          <Field
            label="Zone"
            value={`${CONTINENT_FR[active.continent] ?? active.continent} / ${active.country} · ${active.currency} · ${active.unitSystem === 'metric' ? 'métrique' : 'impérial'}`}
          />

          <Text style={styles.section}>Kilométrage (local)</Text>
          <View style={styles.row}>
            <TextInput
              value={odoDraft}
              onChangeText={setOdoDraft}
              keyboardType="number-pad"
              placeholder="km"
              placeholderTextColor={colors.muted}
              style={[styles.input, { flex: 1 }]}
              accessibilityLabel="Kilométrage"
            />
            <Pressable style={styles.secondary} onPress={saveOdometer}>
              <Text style={styles.secondaryTxt}>Sauver</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Capacité des fluides</Text>
          <Text style={styles.hint}>
            {active.fluidsSource === 'oem_api'
              ? 'Source OEM API'
              : 'Estimation locale (classe / motorisation / cylindrée NHTSA) — API fluides OEM non branchée.'}
          </Text>
          <View style={styles.fluids}>
            <FluidChip label="Huile moteur" value={`${active.fluids.engineOilL} L`} />
            <FluidChip label="Liquide refroid." value={`${active.fluids.coolantL} L`} />
            <FluidChip label="Lave-glace" value={`${active.fluids.washerL} L`} />
            {active.fluids.fuelL != null ? (
              <FluidChip label="Réservoir" value={`${active.fluids.fuelL} L`} />
            ) : null}
          </View>

          {active.techNotes && active.techNotes.length > 0 ? (
            <>
              <Text style={styles.section}>Notes techniques (NHTSA / local)</Text>
              {active.techNotes.map((n) => (
                <Text key={n} style={styles.hint}>
                  · {n}
                </Text>
              ))}
            </>
          ) : null}

          <Text style={styles.section}>Pannes fréquentes (catalogue local)</Text>
          {active.commonFailures.length === 0 ? (
            <Text style={styles.hint}>Aucune panne fréquente en base pour ce véhicule.</Text>
          ) : (
            active.commonFailures.map((f) => (
              <View key={f.id} style={styles.fail}>
                <Text style={styles.failTitle}>{f.title}</Text>
                <Text style={styles.failBody}>
                  Symptômes : {f.symptoms.join(' · ')}
                </Text>
                <Text style={styles.failSev}>
                  Sévérité : {SEV_FR[f.severity] ?? f.severity}
                </Text>
              </View>
            ))
          )}
        </Card>
      ) : (
        <Card title="Aucun véhicule actif">
          <Text style={styles.hint}>Décodez un VIN ou ouvrez la flotte (Module 2).</Text>
        </Card>
      )}

      {active ? (
        <Card title="Rappels constructeur (NHTSA recalls)">
          {recallsLoading ? (
            <Text style={styles.hint}>Chargement NHTSA recallsByVehicle…</Text>
          ) : (
            <>
              <Text style={styles.hint}>
                {recallLabel ?? 'NHTSA recallsByVehicle (API publique gratuite)'}
              </Text>
              {recalls.length === 0 ? (
                <Text style={styles.hint}>Aucun rappel listé pour cette fiche (ou hors couverture NA).</Text>
              ) : (
                recalls.map((r) => (
                  <View key={r.id} style={styles.fail}>
                    <Text style={styles.failTitle}>{r.title}</Text>
                    <Text style={styles.failBody}>
                      {r.component ? `${r.component} · ` : ''}
                      {r.source} · {r.severity}
                    </Text>
                  </View>
                ))
              )}
            </>
          )}
        </Card>
      ) : null}

      {vehicles.length > 1 ? (
        <Card title="Basculer rapidement (flotte)">
          <View style={styles.chips}>
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                style={[styles.chip, active?.id === v.id && styles.chipOn]}
                onPress={() => setActive(v.id)}
              >
                <Text style={[styles.chipTxt, active?.id === v.id && styles.chipTxtOn]}>
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      <Card title="Documents & rappels">
        <Text style={styles.hint}>
          Section Mon véhicule — infos, flotte, carnet & échéances (mock entretien).
        </Text>
        {MOCK_MAINTENANCE.filter((m) => m.status !== 'fait')
          .slice(0, 3)
          .map((m) => (
            <View key={m.id} style={styles.fail}>
              <Text style={styles.failTitle}>{m.title}</Text>
              <Text style={styles.failBody}>
                {m.dueDateIso ? `Échéance ${m.dueDateIso}` : `À ${m.dueKm.toLocaleString('fr-FR')} km`}
                {' · '}
                {m.status === 'a_faire' ? 'à faire' : 'planifié'}
              </Text>
            </View>
          ))}
        <Link href="/modules/entretien" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkTxt}>M10 — entretien, documents & carnet PDF →</Text>
          </Pressable>
        </Link>
        <Link href="/modules/flotte" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkTxt}>M2 — sélecteur cascade & multi-flotte →</Text>
          </Pressable>
        </Link>
        <Link href="/modules/parametres" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkTxt}>Paramètres (préférences · compte) →</Text>
          </Pressable>
        </Link>
        <Link href="/modules/fournitures" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkTxt}>Je fournis / L’app fournit →</Text>
          </Pressable>
        </Link>
      </Card>

      <Link href="/modules/pieces" asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkTxt}>Module 3 — pièces & devis pour ce VIN →</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.line}>
      <Text style={styles.k}>{label} : </Text>
      {value}
    </Text>
  );
}

function FluidChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fluidChip}>
      <Text style={styles.fluidLabel}>{label}</Text>
      <Text style={styles.fluidVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
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
    justifyContent: 'center',
    minHeight: 44,
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
  disabled: { opacity: 0.6 },
  msg: { color: colors.garage, fontSize: 13, fontWeight: '600' },
  line: { color: colors.slate, fontSize: 14, lineHeight: 21 },
  k: { fontWeight: '700', color: colors.ink },
  section: { marginTop: 8, marginBottom: 4, fontWeight: '800', color: colors.ink },
  fluids: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fluidChip: {
    backgroundColor: colors.garageSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '45%',
    flexGrow: 1,
  },
  fluidLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  fluidVal: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  fail: { backgroundColor: colors.signalSoft, borderRadius: 8, padding: 10, gap: 2 },
  failTitle: { fontWeight: '700', color: colors.ink },
  failBody: { color: colors.slate, fontSize: 12 },
  failSev: { color: colors.signal, fontSize: 11, fontWeight: '700' },
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
  linkBtn: { paddingVertical: 8 },
  linkTxt: { color: colors.signal, fontWeight: '700' },
});
