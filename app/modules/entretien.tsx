import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useFleet } from '../../src/context/FleetContext';
import { MOCK_MAINTENANCE } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import type { MaintenanceItem } from '../../src/types/modules';
import { colors } from '../../src/theme/colors';

type AdminReminder = {
  id: string;
  title: string;
  region: string;
  dueDateIso: string;
  status: 'a_faire' | 'planifie' | 'fait';
};

function adminRemindersForCountry(country?: string): AdminReminder[] {
  const c = (country ?? 'FR').toUpperCase();
  if (c === 'CA' || c === 'US') {
    return [
      { id: 'adm-plaq', title: 'Renouvellement plaques / immatriculation', region: 'CA/US', dueDateIso: '2026-12-01', status: 'a_faire' },
      { id: 'adm-ass', title: 'Assurance véhicule', region: 'CA/US', dueDateIso: '2026-11-30', status: 'planifie' },
      { id: 'adm-insp', title: 'Inspection / safety check', region: 'CA/US', dueDateIso: '2027-02-15', status: 'planifie' },
    ];
  }
  if (c === 'AU') {
    return [
      { id: 'adm-rego', title: 'Rego (immatriculation AU)', region: 'AU', dueDateIso: '2026-10-01', status: 'a_faire' },
      { id: 'adm-ctp', title: 'CTP / assurance obligatoire', region: 'AU', dueDateIso: '2026-10-01', status: 'a_faire' },
    ];
  }
  return [
    { id: 'adm-ct', title: 'Contrôle technique', region: 'EU-FR', dueDateIso: '2027-03-01', status: 'planifie' },
    { id: 'adm-ass-eu', title: 'Assurance responsabilité civile', region: 'EU', dueDateIso: '2026-12-15', status: 'a_faire' },
    { id: 'adm-carte', title: 'Carte grise / certificat', region: 'EU', dueDateIso: '2028-01-01', status: 'planifie' },
  ];
}

const STATUS_CYCLE: MaintenanceItem['status'][] = ['a_faire', 'planifie', 'fait'];

function nextStatus(s: MaintenanceItem['status']): MaintenanceItem['status'] {
  const i = STATUS_CYCLE.indexOf(s);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

function statusColor(s: string) {
  if (s === 'fait') return colors.garage;
  if (s === 'planifie') return colors.warn;
  return colors.signal;
}

/** Module 10 — entretien prédictif, rappels admin localisés, carnet PDF (stub clair). */
export default function EntretienScreen() {
  useModuleVisit(10);
  const { active } = useFleet();
  const km = active?.odometerKm ?? 0;
  const [items, setItems] = useState<MaintenanceItem[]>(MOCK_MAINTENANCE);
  const [admin, setAdmin] = useState(() => adminRemindersForCountry(active?.country));
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [batteryV] = useState(12.6);

  const overdue = useMemo(
    () => items.filter((m) => m.status !== 'fait' && m.dueKm <= km),
    [items, km],
  );

  const cycleItem = (id: string) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: nextStatus(x.status) } : x)));

  const cycleAdmin = (id: string) =>
    setAdmin((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: nextStatus(x.status) as AdminReminder['status'] }
          : x,
      ),
    );

  const exportPdf = () => {
    setPdfMsg(
      'Export PDF certifié non branché — aucun fichier généré. Branchez un générateur PDF (carnet + factures) pour activer.',
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Entretien' }} />
      <Screen
        title="Entretien & carnet"
        subtitle={`Module 10 · ${active?.label ?? 'véhicule'} · ${km.toLocaleString('fr-FR')} km`}
      >
        <StubBanner text="STUB — export PDF certifié non branché ; rappels pays en règles locales mock" />

        <Card title="Maintenance automatique">
          <Text style={styles.meta}>
            Vidange, freins, distribution, pneus — selon kilométrage. Touchez pour faire défiler le statut.
          </Text>
          {overdue.length > 0 ? (
            <View style={styles.alert}>
              <Text style={styles.alertTxt}>
                {overdue.length} entretien(s) à échéance ≤ {km.toLocaleString('fr-FR')} km
              </Text>
            </View>
          ) : null}
          {items.map((m) => (
            <Pressable key={m.id} style={styles.row} onPress={() => cycleItem(m.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.title}</Text>
                <Text style={styles.meta}>
                  Échéance {m.dueKm.toLocaleString('fr-FR')} km
                  {m.dueDateIso ? ` · ${m.dueDateIso}` : ''}
                  {m.dueKm <= km && m.status !== 'fait' ? ' · dépassé' : ''}
                </Text>
              </View>
              <Text style={[styles.status, { color: statusColor(m.status) }]}>{m.status}</Text>
            </Pressable>
          ))}
          <Text style={styles.meta}>Batterie (suivi mock) : {batteryV.toFixed(1)} V — OK</Text>
        </Card>

        <Card title={`Rappels administratifs · ${active?.country ?? 'FR'}`}>
          <Text style={styles.meta}>
            Plaques, assurance, contrôle technique / rego selon le pays du véhicule actif.
          </Text>
          <View style={styles.regionRow}>
            {(['FR', 'CA', 'US', 'AU'] as const).map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, (active?.country ?? 'FR') === c && styles.chipOn]}
                onPress={() => setAdmin(adminRemindersForCountry(c))}
              >
                <Text style={[styles.chipTxt, (active?.country ?? 'FR') === c && styles.chipTxtOn]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          {admin.map((r) => (
            <Pressable key={r.id} style={styles.row} onPress={() => cycleAdmin(r.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.title}</Text>
                <Text style={styles.meta}>
                  {r.region} · échéance {r.dueDateIso}
                </Text>
              </View>
              <Text style={[styles.status, { color: statusColor(r.status) }]}>{r.status}</Text>
            </Pressable>
          ))}
        </Card>

        <Card title="Carnet numérique">
          <Text style={styles.meta}>
            Historique réparations / factures — {items.filter((i) => i.status === 'fait').length} entrée(s)
            marquées « fait » dans cette session.
          </Text>
          <Pressable style={styles.export} onPress={exportPdf}>
            <Text style={styles.exportTxt}>Exporter carnet PDF</Text>
          </Pressable>
          {pdfMsg ? <Text style={styles.pdfMsg}>{pdfMsg}</Text> : null}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  name: { fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  status: { fontWeight: '800', textTransform: 'uppercase', fontSize: 11 },
  export: { backgroundColor: colors.asphalt, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  exportTxt: { color: colors.white, fontWeight: '800' },
  pdfMsg: { color: colors.warn, fontWeight: '700', fontSize: 12, marginTop: 8 },
  alert: {
    backgroundColor: colors.warnSoft,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.warn,
    marginBottom: 4,
  },
  alertTxt: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  regionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.mist,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { fontWeight: '700', color: colors.slate, fontSize: 12 },
  chipTxtOn: { color: colors.white },
});
