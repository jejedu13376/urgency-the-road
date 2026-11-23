import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listWeighStations } from '../../src/services/firebase';
import type { WeighListMeta } from '../../src/services/firebase/weighService';
import { haversineKm } from '../../src/services/geo/deviceLocation';
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

function statusBadge(w: WeighStationDoc): { lit: boolean; text: string } {
  if (w.status === 'open' && w.litUp) {
    return { lit: true, text: 'ON / OUVERTE (opening_hours OSM)' };
  }
  if (w.status === 'closed') {
    return { lit: false, text: 'OFF / FERMÉE (opening_hours OSM)' };
  }
  // unknown / untagged OSM — never label as OFF (no live jurisdiction feed)
  return { lit: false, text: 'UNKNOWN (pas de feed juridiction live)' };
}

/** Module 8 — balances OSM + dépôts PL ; pas de faux ON/OFF sans tag. */
export default function RoutiersScreen() {
  useModuleVisit(8);
  const { active } = useFleet();
  const [stations, setStations] = useState<WeighStationDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [meta, setMeta] = useState<WeighListMeta | null>(null);
  const [filter, setFilter] = useState<'all' | 'on' | 'off' | 'unknown'>('all');
  const [regionFilter, setRegionFilter] = useState<WeighStationDoc['region'] | 'all'>('all');
  const [lawRegion, setLawRegion] = useState<WeighStationDoc['region']>('EU');
  const [loading, setLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState(100);

  const reload = async (km = radiusKm) => {
    setLoading(true);
    try {
      const res = await listWeighStations({ radiusKm: km });
      setStations(res.data);
      setLabel(res.stubLabel);
      setMeta(res.meta ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload(radiusKm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm]);

  const visible = useMemo(() => {
    let list = stations;
    if (regionFilter !== 'all') list = list.filter((w) => w.region === regionFilter);
    if (filter === 'on') return list.filter((w) => w.status === 'open' && w.litUp);
    if (filter === 'off') return list.filter((w) => w.status === 'closed');
    if (filter === 'unknown') return list.filter((w) => w.status !== 'open' && w.status !== 'closed');
    return list;
  }, [stations, filter, regionFilter]);

  const onCount = stations.filter((w) => w.status === 'open' && w.litUp).length;
  const offCount = stations.filter((w) => w.status === 'closed').length;
  // Must match UNKNOWN chip: status neither open nor closed (ignore litUp)
  const unknownCount = stations.filter((w) => w.status !== 'open' && w.status !== 'closed').length;
  const originLat = meta?.lat ?? 50.63;
  const originLon = meta?.lon ?? 3.06;
  const depots = meta?.depots ?? [];

  return (
    <>
      <Stack.Screen options={{ title: 'Routiers' }} />
      <Screen
        title="Module routiers"
        subtitle={`Module 8 — pesage & dépôts${active?.vehicleClass === 'poids_lourd' ? ' · véhicule PL actif' : ''}`}
      >
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}
        {meta?.depotLabel ? <StubBanner text={meta.depotLabel} /> : null}

        <Card title="Balances de pesage — statut ON / OFF / UNKNOWN">
          <Text style={styles.hint}>
            Sources OSM (weighbridge). Si tag opening_hours → advisory ON/OFF local. Aucun feed juridiction payant
            temps réel — unknown reste unknown (pas de faux « allumé »).
          </Text>
          <Text style={styles.hint}>
            {meta
              ? `Centre ${meta.lat.toFixed(4)}, ${meta.lon.toFixed(4)} · ${meta.gpsLabel}`
              : 'GPS…'}
          </Text>
          <Text style={styles.hint}>Rayon recherche balances</Text>
          <View style={styles.row}>
            {([40, 80, 100, 150] as const).map((km) => (
              <Pressable
                key={km}
                style={[styles.chip, radiusKm === km && styles.chipOn]}
                onPress={() => setRadiusKm(km)}
              >
                <Text style={[styles.chipTxt, radiusKm === km && styles.chipTxtOn]}>{km} km</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.refresh} onPress={() => void reload(radiusKm)} disabled={loading}>
            <Text style={styles.refreshTxt}>
              {loading ? 'Chargement OSM…' : `Rafraîchir balances / dépôts · ${radiusKm} km`}
            </Text>
          </Pressable>
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
            <Pressable style={[styles.chip, filter === 'unknown' && styles.chipOn]} onPress={() => setFilter('unknown')}>
              <Text style={[styles.chipTxt, filter === 'unknown' && styles.chipTxtOn]}>UNKNOWN ({unknownCount})</Text>
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
            const badge = statusBadge(w);
            const distKm = Math.round(haversineKm(originLat, originLon, w.lat, w.lon) * 10) / 10;
            return (
              <View key={w.id} style={[styles.rowCard, badge.lit ? styles.rowLit : styles.rowOff]}>
                <View style={styles.rowHead}>
                  <Text style={styles.name}>{w.name}</Text>
                  <Text style={[styles.statusBadge, badge.lit ? styles.statusOn : styles.statusOff]}>
                    {badge.text}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  {w.region} · {w.address} · ~{distKm} km
                </Text>
                <Text style={styles.meta}>
                  H max {w.heightLimitM ?? '—'} m · Poids max {w.weightLimitT ?? '—'} t · statut {w.status}
                </Text>
                <Pressable
                  style={styles.maps}
                  onPress={() =>
                    void Linking.openURL(
                      `https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lon}`,
                    )
                  }
                >
                  <Text style={styles.callTxt}>Itinéraire balance</Text>
                </Pressable>
              </View>
            );
          })}
          {visible.length === 0 ? <Text style={styles.meta}>Aucune balance pour ce filtre.</Text> : null}
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
          <Text style={styles.section}>Dépôts / magasins / truck stops</Text>
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
                    `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}`,
                  )
                }
              >
                <Text style={styles.callTxt}>Itinéraire dépôt</Text>
              </Pressable>
            </View>
          ))}
          {depots.length === 0 ? <Text style={styles.meta}>Aucun dépôt proche.</Text> : null}
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
  refresh: {
    backgroundColor: colors.asphalt,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginVertical: 6,
  },
  refreshTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
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
  rowOff: { opacity: 0.9 },
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
