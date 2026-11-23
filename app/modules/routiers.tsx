import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { MOCK_PLACES } from '../../src/data/mocks';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listWeighStations } from '../../src/services/firebase';
import type { WeighStationDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const LAW_BY_REGION: Record<WeighStationDoc['region'], { title: string; lines: string[] }> = {
  EU: {
    title: 'Loi camionnage — Europe (pesage)',
    lines: [
      'Contrôle hauteur / PTAC aux postes de pesage autoroutiers.',
      'Respecter interdictions PL locales et gabarits de ponts.',
      'ADR : documents + itinéraires matières dangereuses si applicable.',
    ],
  },
  NA: {
    title: 'Loi camionnage — Amérique du Nord',
    lines: [
      'Weigh stations ON = ouvertes / allumées — s’arrêter si signalé.',
      'Bridge clearance & weight limits state/province.',
      'Hazmat : routes et stations dédiées selon juridiction.',
    ],
  },
  AU: {
    title: 'Loi camionnage — Australie',
    lines: [
      'Heavy vehicle permits & mass limits selon corridor.',
      'Rest areas / dépôts PL pour conformité fatigue.',
      'Hauteur et largeur : vérifier avant passage balances.',
    ],
  },
};

/** Module 8 — balances ON/OFF, loi camionnage, dépôts PL. */
export default function RoutiersScreen() {
  useModuleVisit(8);
  const { active } = useFleet();
  const [stations, setStations] = useState<WeighStationDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [filter, setFilter] = useState<'all' | 'on' | 'off'>('all');
  const [regionFilter, setRegionFilter] = useState<WeighStationDoc['region'] | 'all'>('all');
  const [lawRegion, setLawRegion] = useState<WeighStationDoc['region']>('EU');
  const depots = MOCK_PLACES.filter((p) => p.kind === 'depot_pl' || p.kind === 'pieces');
  const relays = MOCK_PLACES.filter((p) => p.kind === 'depannage');

  useEffect(() => {
    void (async () => {
      const res = await listWeighStations();
      // Enrich mock list with a closed station so ON/OFF is demonstrable
      const base = res.data;
      const withClosed: WeighStationDoc[] =
        base.some((s) => !s.litUp || s.status === 'closed')
          ? base
          : [
              ...base,
              {
                id: 'w-closed-demo',
                name: 'Poste de pesage A1 (nuit)',
                address: 'Aire de Seclin',
                lat: 50.55,
                lon: 3.05,
                region: 'EU',
                status: 'closed',
                litUp: false,
                heightLimitM: 4.0,
                weightLimitT: 40,
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'w-na-demo',
                name: 'Weigh Station I-95 (mock NA)',
                address: 'Mile 42',
                lat: 40.1,
                lon: -74.5,
                region: 'NA',
                status: 'open',
                litUp: true,
                heightLimitM: 4.1,
                weightLimitT: 36,
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'w-au-demo',
                name: 'HV Inspection Bay (mock AU)',
                address: 'Pacific Hwy',
                lat: -33.8,
                lon: 151.1,
                region: 'AU',
                status: 'open',
                litUp: true,
                heightLimitM: 4.3,
                weightLimitT: 42.5,
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'w-na-off',
                name: 'Weigh Station Hwy 401 (éteint)',
                address: 'Ontario mock',
                lat: 43.7,
                lon: -79.4,
                region: 'NA',
                status: 'closed',
                litUp: false,
                heightLimitM: 4.15,
                weightLimitT: 40,
                updatedAt: new Date().toISOString(),
              },
            ];
      setStations(withClosed);
      setLabel(res.stubLabel);
    })();
  }, []);

  const visible = useMemo(() => {
    let list = stations;
    if (regionFilter !== 'all') list = list.filter((w) => w.region === regionFilter);
    if (filter === 'on') return list.filter((w) => w.litUp && w.status === 'open');
    if (filter === 'off') return list.filter((w) => !w.litUp || w.status === 'closed');
    return list;
  }, [stations, filter, regionFilter]);

  const onCount = stations.filter((w) => w.litUp && w.status === 'open').length;
  const offCount = stations.length - onCount;

  return (
    <>
      <Stack.Screen options={{ title: 'Routiers' }} />
      <Screen
        title="Module routiers"
        subtitle={`Module 8 — pesage & dépôts${active?.vehicleClass === 'poids_lourd' ? ' · véhicule PL actif' : ''}`}
      >
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}

        <Card title="Balances de pesage — statut ON / OFF">
          <Text style={styles.hint}>
            Afficher clairement les postes allumés / ouverts vs fermés / éteints (EU · NA · AU).
          </Text>
          <View style={styles.row}>
            <Pressable style={[styles.chip, filter === 'all' && styles.chipOn]} onPress={() => setFilter('all')}>
              <Text style={[styles.chipTxt, filter === 'all' && styles.chipTxtOn]}>Toutes ({stations.length})</Text>
            </Pressable>
            <Pressable style={[styles.chip, filter === 'on' && styles.chipOnGreen]} onPress={() => setFilter('on')}>
              <Text style={[styles.chipTxt, filter === 'on' && styles.chipTxtOn]}>ALLUMÉES ({onCount})</Text>
            </Pressable>
            <Pressable style={[styles.chip, filter === 'off' && styles.chipOnDark]} onPress={() => setFilter('off')}>
              <Text style={[styles.chipTxt, filter === 'off' && styles.chipTxtOn]}>ÉTEINTES ({offCount})</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            {(['all', 'EU', 'NA', 'AU'] as const).map((r) => (
              <Pressable key={r} style={[styles.chip, regionFilter === r && styles.chipOn]} onPress={() => setRegionFilter(r)}>
                <Text style={[styles.chipTxt, regionFilter === r && styles.chipTxtOn]}>{r === 'all' ? 'Régions' : r}</Text>
              </Pressable>
            ))}
          </View>
          {visible.map((w) => {
            const lit = w.litUp && w.status === 'open';
            const distKm = Math.round((Math.abs(w.lat - 50.63) + Math.abs(w.lon - 3.06)) * 40 + 4);
            return (
              <View key={w.id} style={[styles.rowCard, lit ? styles.rowLit : styles.rowOff]}>
                <View style={styles.rowHead}>
                  <Text style={styles.name}>{w.name}</Text>
                  <Text style={[styles.statusBadge, lit ? styles.statusOn : styles.statusOff]}>
                    {lit ? 'ON / OUVERTE' : 'OFF / FERMÉE'}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  {w.region} · {w.address} · ~{distKm} km
                </Text>
                <Text style={styles.meta}>
                  H max {w.heightLimitM ?? '—'} m · Poids max {w.weightLimitT ?? '—'} t · statut {w.status}
                </Text>
              </View>
            );
          })}
        </Card>

        <Card title="Infos loi camionnage (pesage)">
          <View style={styles.row}>
            {(['EU', 'NA', 'AU'] as const).map((r) => (
              <Pressable key={r} style={[styles.chip, lawRegion === r && styles.chipOn]} onPress={() => setLawRegion(r)}>
                <Text style={[styles.chipTxt, lawRegion === r && styles.chipTxtOn]}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.lawTitle}>{LAW_BY_REGION[lawRegion].title}</Text>
          {LAW_BY_REGION[lawRegion].lines.map((line) => (
            <Text key={line} style={styles.meta}>
              · {line}
            </Text>
          ))}
          <Link href="/modules/gps" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkTxt}>GPS mode camion — hauteur / PTAC (M7) →</Text>
            </Pressable>
          </Link>
        </Card>

        <Card title="Dépôts pièces PL & relais">
          <Text style={styles.section}>Dépôts / magasins</Text>
          {depots.map((d) => (
            <View key={d.id} style={styles.rowCard}>
              <Text style={styles.name}>{d.name}</Text>
              <Text style={styles.meta}>
                {d.address} · {d.hours} · {d.distanceKm} km · ~{d.etaMin} min
              </Text>
              {d.phone !== 'N/A' ? (
                <Pressable style={styles.call} onPress={() => void Linking.openURL(`tel:${d.phone}`)}>
                  <Text style={styles.callTxt}>Appeler {d.phone}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.maps}
                onPress={() =>
                  void Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.name + ' ' + d.address)}`,
                  )
                }
              >
                <Text style={styles.callTxt}>Itinéraire dépôt</Text>
              </Pressable>
            </View>
          ))}
          <Text style={styles.section}>Relais / dépannage</Text>
          {relays.map((d) => (
            <View key={d.id} style={styles.rowCard}>
              <Text style={styles.name}>{d.name}</Text>
              <Text style={styles.meta}>
                {d.hours} · {d.distanceKm} km · {d.phone}
              </Text>
            </View>
          ))}
          <Link href="/modules/garages" asChild>
            <Pressable style={styles.linkSoft}>
              <Text style={styles.linkSoftTxt}>Carte garages & dépanneurs (M9) →</Text>
            </Pressable>
          </Link>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipOnGreen: { backgroundColor: colors.garage, borderColor: colors.garage },
  chipOnDark: { backgroundColor: colors.slate, borderColor: colors.slate },
  chipTxt: { color: colors.slate, fontSize: 12, fontWeight: '600' },
  chipTxtOn: { color: colors.white },
  rowCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 4,
  },
  rowLit: { backgroundColor: colors.garageSoft, marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 8 },
  rowOff: { opacity: 0.85 },
  rowHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  statusBadge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  statusOn: { backgroundColor: colors.garage, color: colors.white },
  statusOff: { backgroundColor: colors.mist, color: colors.slate },
  lawTitle: { fontWeight: '800', color: colors.ink, marginTop: 4 },
  section: { fontWeight: '800', color: colors.ink, marginTop: 6 },
  call: { backgroundColor: colors.garage, borderRadius: 8, padding: 8, alignItems: 'center', alignSelf: 'flex-start' },
  maps: { backgroundColor: colors.signal, borderRadius: 8, padding: 8, alignItems: 'center', alignSelf: 'flex-start' },
  callTxt: { color: colors.white, fontWeight: '800', fontSize: 12 },
  linkBtn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 6 },
  linkTxt: { color: colors.white, fontWeight: '800' },
  linkSoft: {
    marginTop: 8,
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  linkSoftTxt: { color: colors.ink, fontWeight: '700', fontSize: 13 },
});
