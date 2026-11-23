import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

type CarnetEntry = {
  id: string;
  title: string;
  km: number;
  dateIso: string;
  cost?: number;
  currency?: string;
  invoiceRef?: string;
};

function adminRemindersForCountry(country?: string): AdminReminder[] {
  const c = (country ?? 'FR').toUpperCase();
  if (c === 'CA' || c === 'US') {
    return [
      {
        id: 'adm-plaq',
        title: 'Renouvellement plaques / immatriculation',
        region: 'CA/US',
        dueDateIso: '2026-12-01',
        status: 'a_faire',
      },
      {
        id: 'adm-ass',
        title: 'Assurance véhicule',
        region: 'CA/US',
        dueDateIso: '2026-11-30',
        status: 'planifie',
      },
      {
        id: 'adm-insp',
        title: 'Inspection / safety check',
        region: 'CA/US',
        dueDateIso: '2027-02-15',
        status: 'planifie',
      },
    ];
  }
  if (c === 'AU') {
    return [
      {
        id: 'adm-rego',
        title: 'Rego (immatriculation AU)',
        region: 'AU',
        dueDateIso: '2026-10-01',
        status: 'a_faire',
      },
      {
        id: 'adm-ctp',
        title: 'CTP / assurance obligatoire',
        region: 'AU',
        dueDateIso: '2026-10-01',
        status: 'a_faire',
      },
    ];
  }
  return [
    {
      id: 'adm-ct',
      title: 'Contrôle technique',
      region: 'EU-FR',
      dueDateIso: '2027-03-01',
      status: 'planifie',
    },
    {
      id: 'adm-ass-eu',
      title: 'Assurance responsabilité civile',
      region: 'EU',
      dueDateIso: '2026-12-15',
      status: 'a_faire',
    },
    {
      id: 'adm-carte',
      title: 'Carte grise / certificat',
      region: 'EU',
      dueDateIso: '2028-01-01',
      status: 'planifie',
    },
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

const INITIAL_CARNET: CarnetEntry[] = [
  {
    id: 'c1',
    title: 'Vidange + filtre huile',
    km: 62000,
    dateIso: '2026-06-12',
    cost: 189,
    currency: 'EUR',
    invoiceRef: 'FAC-2606-014',
  },
  {
    id: 'c2',
    title: 'Pneus avant (2×)',
    km: 64800,
    dateIso: '2026-09-03',
    cost: 220,
    currency: 'EUR',
    invoiceRef: 'FAC-2609-088',
  },
];

/** Module 10 — entretien prédictif, rappels admin localisés, carnet PDF (stub clair). */
export default function EntretienScreen() {
  useModuleVisit(10);
  const { active } = useFleet();
  const km = active?.odometerKm ?? 0;
  const [items, setItems] = useState<MaintenanceItem[]>([
    ...MOCK_MAINTENANCE,
    { id: 'm5', title: 'Distribution / chaîne', dueKm: 120000, status: 'planifie' },
    { id: 'm6', title: 'Pneus (usure / pression)', dueKm: 75000, status: 'a_faire' },
  ]);
  const [adminCountry, setAdminCountry] = useState(active?.country ?? 'FR');
  const [admin, setAdmin] = useState(() => adminRemindersForCountry(active?.country));
  const [carnet, setCarnet] = useState<CarnetEntry[]>(INITIAL_CARNET);
  const [newTitle, setNewTitle] = useState('');
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
        x.id === id ? { ...x, status: nextStatus(x.status) as AdminReminder['status'] } : x,
      ),
    );

  const switchCountry = (c: string) => {
    setAdminCountry(c);
    setAdmin(adminRemindersForCountry(c));
  };

  const addCarnet = () => {
    const title = newTitle.trim();
    if (!title) return;
    setCarnet((prev) => [
      {
        id: `c-${Date.now()}`,
        title,
        km,
        dateIso: new Date().toISOString().slice(0, 10),
        cost: undefined,
        currency: active?.currency ?? 'EUR',
      },
      ...prev,
    ]);
    setNewTitle('');
  };

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

        <Card title="Maintenance automatique (km)">
          <Text style={styles.meta}>
            Vidange, freins, distribution, pneus — selon kilométrage. Touchez pour faire défiler le
            statut.
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

        <Card title={`Rappels administratifs · ${adminCountry}`}>
          <Text style={styles.meta}>
            Plaques, assurance, contrôle technique / rego / inspection selon le pays.
          </Text>
          <View style={styles.regionRow}>
            {(['FR', 'CA', 'US', 'AU', 'DE'] as const).map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, adminCountry === c && styles.chipOn]}
                onPress={() => switchCountry(c)}
              >
                <Text style={[styles.chipTxt, adminCountry === c && styles.chipTxtOn]}>{c}</Text>
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
            Historique réparations / factures — liste locale + entrées marquées « fait » (
            {items.filter((i) => i.status === 'fait').length}).
          </Text>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Ajouter une intervention…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable style={styles.btnDark} onPress={addCarnet}>
            <Text style={styles.exportTxt}>Ajouter au carnet</Text>
          </Pressable>
          {carnet.map((e) => (
            <View key={e.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{e.title}</Text>
                <Text style={styles.meta}>
                  {e.dateIso} · {e.km.toLocaleString('fr-FR')} km
                  {e.invoiceRef ? ` · ${e.invoiceRef}` : ''}
                </Text>
              </View>
              {e.cost != null ? (
                <Text style={styles.cost}>
                  {e.cost} {e.currency}
                </Text>
              ) : (
                <Text style={styles.meta}>—</Text>
              )}
            </View>
          ))}
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
  cost: { fontWeight: '800', color: colors.signal },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
    marginTop: 6,
  },
  btnDark: {
    backgroundColor: colors.asphalt,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  export: {
    backgroundColor: colors.asphalt,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
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
