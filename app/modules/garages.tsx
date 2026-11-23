import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { MOCK_PLACES } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listGaragesNearby, submitGarageRating } from '../../src/services/firebase';
import type { GarageDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const KIND_LABEL: Record<GarageDoc['kind'], string> = {
  garage: 'Garage indépendant',
  depannage: 'Dépanneuse',
  pieces: 'Magasin de pièces',
  concession: 'Concession',
  mobile: 'Mécanicien mobile',
  depot_pl: 'Dépôt poids lourd',
};

const KIND_FILTERS: Array<GarageDoc['kind'] | 'all'> = [
  'all',
  'garage',
  'depannage',
  'pieces',
  'concession',
  'mobile',
  'depot_pl',
];

/** Module 9 — carte pins, appel 1 clic, contexte PL → M7/M8. */
export default function GaragesScreen() {
  useModuleVisit(9);
  const { profile } = useAuth();
  const { active } = useFleet();
  const isPl = active?.vehicleClass === 'poids_lourd';
  const [places, setPlaces] = useState<GarageDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [msg, setMsg] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<GarageDoc['kind'] | 'all'>('all');

  useEffect(() => {
    void (async () => {
      const res = await listGaragesNearby();
      setPlaces(res.data);
      setLabel(res.stubLabel);
    })();
  }, []);

  const distanceById = useMemo(() => {
    const map = new Map<string, { distanceKm: number; etaMin: number }>();
    for (const p of MOCK_PLACES) {
      map.set(p.id, { distanceKm: p.distanceKm, etaMin: p.etaMin });
    }
    return map;
  }, []);

  const visible = useMemo(
    () => (kindFilter === 'all' ? places : places.filter((p) => p.kind === kindFilter)),
    [places, kindFilter],
  );

  const openMaps = (p: GarageDoc) => {
    const q = encodeURIComponent(`${p.name} ${p.address}`);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Garages GPS' }} />
      <Screen
        title="Autour de moi"
        subtitle={`Module 9 · ${places.length} pin(s)${isPl ? ' · contexte PL' : ''}`}
      >
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}

        {isPl ? (
          <Card title="Contexte poids lourd">
            <Text style={styles.hint}>
              Véhicule actif PL — accès rapide hauteur / poids / balances allumées (sans dupliquer M8).
            </Text>
            <Link href="/modules/gps" asChild>
              <Pressable style={styles.plBtn}>
                <Text style={styles.plBtnTxt}>GPS camion — gabarit & PTAC (M7) →</Text>
              </Pressable>
            </Link>
            <Link href="/modules/routiers" asChild>
              <Pressable style={styles.plBtnAlt}>
                <Text style={styles.plBtnTxt}>Balances ON/OFF & loi pesage (M8) →</Text>
              </Pressable>
            </Link>
          </Card>
        ) : null}

        <Card title="Filtres">
          <View style={styles.row}>
            {KIND_FILTERS.map((k) => (
              <Pressable
                key={k}
                style={[styles.chip, kindFilter === k && styles.chipOn]}
                onPress={() => setKindFilter(k)}
              >
                <Text style={[styles.chipTxt, kindFilter === k && styles.chipTxtOn]}>
                  {k === 'all' ? 'Tous' : KIND_LABEL[k]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {visible.map((p) => {
          const dist = distanceById.get(p.id);
          return (
            <Card key={p.id} title={p.name}>
              <Text style={styles.kind}>{KIND_LABEL[p.kind] ?? p.kind}</Text>
              <Text style={styles.line}>{p.address}</Text>
              <Text style={styles.line}>
                {p.hours}
                {dist ? ` · ${dist.distanceKm} km · ~${dist.etaMin} min` : ''}
                {' · ★ '}
                {p.ratingAvg ?? '—'}
                {p.ratingCount != null ? ` (${p.ratingCount})` : ''}
              </Text>
              <View style={styles.actions}>
                <Pressable style={styles.call} onPress={() => void Linking.openURL(`tel:${p.phone}`)}>
                  <Text style={styles.callTxt}>Appeler {p.phone}</Text>
                </Pressable>
                <Pressable style={styles.maps} onPress={() => openMaps(p)}>
                  <Text style={styles.callTxt}>Itinéraire</Text>
                </Pressable>
                <Pressable
                  style={styles.rate}
                  onPress={() =>
                    void submitGarageRating({
                      garageId: p.id,
                      authorUid: profile?.uid ?? 'mock-local-user',
                      stars: 5,
                      comment: 'Bon accueil (demo)',
                    }).then((r) => setMsg(r.stubLabel ?? 'Note envoyée'))
                  }
                >
                  <Text style={styles.callTxt}>Noter 5★</Text>
                </Pressable>
              </View>
              {p.kind === 'depot_pl' || isPl ? (
                <Link href="/modules/routiers" asChild>
                  <Pressable style={styles.linkSoft}>
                    <Text style={styles.linkSoftTxt}>Infos PL / balances →</Text>
                  </Pressable>
                </Link>
              ) : null}
            </Card>
          );
        })}

        {visible.length === 0 ? <Text style={styles.line}>Aucun pin pour ce filtre.</Text> : null}
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        <Card title="Suite">
          <Link href="/modules/pieces" asChild>
            <Pressable style={styles.linkSoft}>
              <Text style={styles.linkSoftTxt}>Commander pièces compatibles (M3) →</Text>
            </Pressable>
          </Link>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  kind: { color: colors.signal, fontWeight: '800', fontSize: 12 },
  line: { color: colors.slate },
  msg: { color: colors.garage, fontWeight: '700' },
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
  chipTxt: { color: colors.slate, fontSize: 11, fontWeight: '600' },
  chipTxtOn: { color: colors.white },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  call: { backgroundColor: colors.garage, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  maps: { backgroundColor: colors.signal, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rate: { backgroundColor: colors.asphalt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  callTxt: { color: colors.white, fontWeight: '800', fontSize: 12 },
  plBtn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  plBtnAlt: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  plBtnTxt: { color: colors.white, fontWeight: '800' },
  linkSoft: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  linkSoftTxt: { color: colors.ink, fontWeight: '700', fontSize: 13 },
});
