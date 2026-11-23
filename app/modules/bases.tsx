import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { stubOtaSync } from '../../src/services/stubs';
import { colors } from '../../src/theme/colors';

type LearnEntry = {
  id: string;
  title: string;
  source: string;
  region: string;
  at: string;
  tags?: string[];
};

const INITIAL_LOG: LearnEntry[] = [
  {
    id: '1',
    title: 'Fuite joint collecteur Clio V',
    source: 'multi-IA + web',
    region: 'EU-FR',
    at: '2026-11-20T09:12:00Z',
    tags: ['échappement', 'joint'],
  },
  {
    id: '2',
    title: 'NOx FMI2 Actros',
    source: 'TSB web',
    region: 'EU-DE',
    at: '2026-11-21T14:40:00Z',
    tags: ['PL', 'AdBlue'],
  },
  {
    id: '3',
    title: 'Camphaser F-150 cold start',
    source: 'recall constructeur',
    region: 'NA-CA',
    at: '2026-11-22T08:05:00Z',
    tags: ['moteur', 'AAC'],
  },
  {
    id: '4',
    title: 'Régénération FAP forcée — TDI',
    source: 'multi-IA + forum tech',
    region: 'EU',
    at: '2026-11-22T16:20:00Z',
    tags: ['FAP', 'diesel'],
  },
];

/** Module 14 — auto-apprentissage des pannes + statut OTA. */
export default function BasesScreen() {
  useModuleVisit(14);
  const [log, setLog] = useState<LearnEntry[]>(INITIAL_LOG);
  const [draft, setDraft] = useState('');
  const [region, setRegion] = useState('local');
  const [sync, setSync] = useState<ReturnType<typeof stubOtaSync> | null>(null);
  const [otaStatus, setOtaStatus] = useState<'idle' | 'syncing' | 'a_jour' | 'echec'>('idle');
  const [filter, setFilter] = useState<'all' | 'local' | 'web'>('all');

  const visible = log.filter((l) => {
    if (filter === 'local') return l.region === 'local' || l.source.includes('locale');
    if (filter === 'web') return !l.source.includes('locale');
    return true;
  });

  const addLearned = () => {
    const title = draft.trim();
    if (!title) return;
    setLog((prev) => [
      {
        id: `l-${Date.now()}`,
        title,
        source: 'session locale (enrichissement UI)',
        region,
        at: new Date().toISOString(),
        tags: ['manuel'],
      },
      ...prev,
    ]);
    setDraft('');
  };

  const runOta = () => {
    setOtaStatus('syncing');
    setTimeout(() => {
      const r = stubOtaSync();
      setSync(r);
      setOtaStatus('a_jour');
    }, 700);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Bases & OTA' }} />
      <Screen title="Bases évolutives" subtitle="Module 14 — auto-apprentissage & OTA">
        <StubBanner text="STUB — apprentissage cloud & OTA non branchés ; journal local pour démonstration UI" />

        <Card title="Statut OTA">
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Mise à jour automatique</Text>
            <Text
              style={[
                styles.badge,
                otaStatus === 'a_jour' && styles.badgeOk,
                otaStatus === 'syncing' && styles.badgeWarn,
                otaStatus === 'echec' && styles.badgeBad,
              ]}
            >
              {otaStatus === 'idle' && 'En attente'}
              {otaStatus === 'syncing' && 'Sync…'}
              {otaStatus === 'a_jour' && 'À jour (mock)'}
              {otaStatus === 'echec' && 'Échec'}
            </Text>
          </View>
          <Text style={styles.meta}>
            Bases véhicules, tarifs pièces et fonctionnalités — actualisation sans intervention
            complexe (Android / iOS / desktop) une fois le canal OTA branché.
          </Text>
          <Pressable style={styles.btn} onPress={runOta} disabled={otaStatus === 'syncing'}>
            <Text style={styles.btnTxt}>
              {otaStatus === 'syncing' ? 'Synchronisation…' : 'Synchroniser OTA (stub)'}
            </Text>
          </Pressable>
          {sync ? (
            <View style={styles.syncBox}>
              <StubBanner text={sync.label} />
              <Text style={styles.meta}>
                Dernière sync : {new Date(sync.data.lastSync).toLocaleString('fr-FR')} ·{' '}
                {sync.data.learnedFailures} pannes enrichies (mock)
              </Text>
            </View>
          ) : null}
        </Card>

        <Card title="Journal d’auto-apprentissage">
          <Text style={styles.meta}>
            Chaque panne résolue via Multi-IA + recherche web est enregistrée pour enrichir la base
            mondiale.
          </Text>
          <View style={styles.filterRow}>
            {(['all', 'web', 'local'] as const).map((f) => (
              <Pressable
                key={f}
                style={[styles.chip, filter === f && styles.chipOn]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.chipTxt, filter === f && styles.chipTxtOn]}>
                  {f === 'all' ? 'Toutes' : f === 'web' ? 'Web / TSB' : 'Local'}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Nouvelle panne apprise (titre)…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={styles.filterRow}>
            {(['local', 'EU-FR', 'NA-CA', 'AU'] as const).map((r) => (
              <Pressable
                key={r}
                style={[styles.chip, region === r && styles.chipOn]}
                onPress={() => setRegion(r)}
              >
                <Text style={[styles.chipTxt, region === r && styles.chipTxtOn]}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.btnDark} onPress={addLearned}>
            <Text style={styles.btnTxt}>Ajouter au journal local</Text>
          </Pressable>
          <Text style={styles.count}>{visible.length} entrée(s)</Text>
          {visible.map((l) => (
            <View key={l.id} style={styles.row}>
              <Text style={styles.title}>{l.title}</Text>
              <Text style={styles.meta}>
                {l.source} · {l.region} · {new Date(l.at).toLocaleString('fr-FR')}
              </Text>
              {l.tags?.length ? (
                <Text style={styles.tags}>{l.tags.map((t) => `#${t}`).join(' ')}</Text>
              ) : null}
            </View>
          ))}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  tags: { color: colors.signal, fontSize: 11, fontWeight: '700', marginTop: 2 },
  count: { color: colors.slate, fontWeight: '700', fontSize: 12, marginTop: 8 },
  btn: { backgroundColor: colors.signal, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  btnDark: { backgroundColor: colors.asphalt, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: colors.white, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
    marginTop: 8,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontWeight: '800', color: colors.ink },
  badge: {
    fontWeight: '800',
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.mist,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgeOk: { color: colors.garage, backgroundColor: colors.garageSoft },
  badgeWarn: { color: colors.warn, backgroundColor: colors.warnSoft },
  badgeBad: { color: colors.danger, backgroundColor: colors.dangerSoft },
  syncBox: { marginTop: 8, gap: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.mist,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { fontWeight: '700', color: colors.slate, fontSize: 11 },
  chipTxtOn: { color: colors.white },
});
