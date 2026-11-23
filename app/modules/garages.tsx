import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listGaragesNearby, submitGarageRating } from '../../src/services/firebase';
import type { NearbyGaragesMeta } from '../../src/services/firebase/garagesService';
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

/** Module 9 — OSM Overpass + GPS device ; tel: / maps ; contexte PL → M7/M8. */
export default function GaragesScreen() {
  useModuleVisit(9);
  const { profile } = useAuth();
  const { active } = useFleet();
  const isPl = active?.vehicleClass === 'poids_lourd';
  const [places, setPlaces] = useState<GarageDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [meta, setMeta] = useState<NearbyGaragesMeta | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<GarageDoc['kind'] | 'all'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);

  const reload = async (km = radiusKm) => {
    setLoading(true);
    try {
      const res = await listGaragesNearby({ radiusKm: km });
      setPlaces(res.data);
      setLabel(res.stubLabel);
      setMeta(res.meta ?? null);
      setSelectedId((prev) => {
        if (prev && res.data.some((p) => p.id === prev)) return prev;
        return res.data[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload(radiusKm);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + radius chip drives reload
  }, [radiusKm]);

  const distanceById = useMemo(() => meta?.distanceById ?? {}, [meta]);

  const visible = useMemo(() => {
    const list = kindFilter === 'all' ? [...places] : places.filter((p) => p.kind === kindFilter);
    list.sort((a, b) => {
      if (sortBy === 'rating') return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
      const da = distanceById[a.id]?.distanceKm ?? 99;
      const db = distanceById[b.id]?.distanceKm ?? 99;
      return da - db;
    });
    return list;
  }, [places, kindFilter, sortBy, distanceById]);

  const openMaps = (p: GarageDoc) => {
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`,
    );
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
              Véhicule actif PL — accès rapide hauteur / poids / balances (sans dupliquer M8).
            </Text>
            <Link href="/modules/gps" asChild>
              <Pressable style={styles.plBtn}>
                <Text style={styles.plBtnTxt}>GPS camion — gabarit & PTAC (M7) →</Text>
              </Pressable>
            </Link>
            <Link href="/modules/routiers" asChild>
              <Pressable style={styles.plBtnAlt}>
                <Text style={styles.plBtnTxt}>Balances & loi pesage (M8) →</Text>
              </Pressable>
            </Link>
          </Card>
        ) : null}

        <Card title="Filtres">
          <Text style={styles.hint}>
            {meta
              ? `Centre ${meta.lat.toFixed(4)}, ${meta.lon.toFixed(4)} · ${meta.gpsLabel}`
              : 'Localisation en cours…'}
          </Text>
          <Text style={styles.hint}>Rayon Overpass / Photon</Text>
          <View style={styles.row}>
            {([5, 10, 15, 25] as const).map((km) => (
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
              {loading ? 'Chargement OSM…' : `Rafraîchir · rayon ${radiusKm} km`}
            </Text>
          </Pressable>
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
          <View style={styles.row}>
            <Pressable style={[styles.chip, sortBy === 'distance' && styles.chipOn]} onPress={() => setSortBy('distance')}>
              <Text style={[styles.chipTxt, sortBy === 'distance' && styles.chipTxtOn]}>Tri distance</Text>
            </Pressable>
            <Pressable style={[styles.chip, sortBy === 'rating' && styles.chipOn]} onPress={() => setSortBy('rating')}>
              <Text style={[styles.chipTxt, sortBy === 'rating' && styles.chipTxtOn]}>Tri notes</Text>
            </Pressable>
          </View>
        </Card>

        {visible.map((p) => {
          const dist = distanceById[p.id];
          const selected = selectedId === p.id;
          return (
            <Card key={p.id} title={p.name}>
              <Pressable onPress={() => setSelectedId(p.id)}>
                <Text style={styles.kind}>{KIND_LABEL[p.kind] ?? p.kind}</Text>
                <Text style={styles.line}>{p.address}</Text>
                <View style={styles.pinMeta}>
                  <Text style={styles.metaChip}>Horaires {p.hours}</Text>
                  {dist ? (
                    <>
                      <Text style={styles.metaChip}>{dist.distanceKm} km</Text>
                      <Text style={styles.metaChip}>ETA ~{dist.etaMin} min</Text>
                    </>
                  ) : null}
                  {p.ratingAvg != null ? (
                    <Text style={styles.metaChip}>
                      ★ {p.ratingAvg}
                      {p.ratingCount != null ? ` (${p.ratingCount})` : ''}
                    </Text>
                  ) : (
                    <Text style={styles.metaChip}>★ — (OSM)</Text>
                  )}
                </View>
                <Text style={styles.coords}>
                  Pin {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                  {selected ? ' · sélectionné' : ''}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                {p.phone !== 'N/A' ? (
                  <Pressable style={styles.call} onPress={() => void Linking.openURL(`tel:${p.phone}`)}>
                    <Text style={styles.callTxt}>Appeler {p.phone}</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.maps} onPress={() => openMaps(p)}>
                  <Text style={styles.callTxt}>Maps</Text>
                </Pressable>
                <Pressable
                  style={styles.waze}
                  onPress={() => void Linking.openURL(`https://waze.com/ul?ll=${p.lat}%2C${p.lon}&navigate=yes`)}
                >
                  <Text style={styles.callTxt}>Waze</Text>
                </Pressable>
                <Pressable
                  style={styles.rate}
                  onPress={() => {
                    if (!profile?.uid) {
                      setMsg('Note non syncée — connectez-vous (M15) pour écrire dans Firestore.');
                      return;
                    }
                    void submitGarageRating({
                      garageId: p.id,
                      authorUid: profile.uid,
                      stars: 5,
                      comment: 'Bon accueil',
                    }).then((r) => {
                      setMsg(
                        r.ok === false
                          ? r.stubLabel ?? 'Échec note'
                          : r.stubLabel ?? 'Note envoyée Firestore',
                      );
                      if (r.ok !== false) {
                        // Optimistic only — no Overpass reload (avoids Photon/mock swap + selection jump)
                        setPlaces((prev) =>
                          prev.map((g) => {
                            if (g.id !== p.id) return g;
                            const count = (g.ratingCount ?? 0) + 1;
                            const avg =
                              g.ratingAvg != null
                                ? Math.round(((g.ratingAvg * (count - 1) + 5) / count) * 10) / 10
                                : 5;
                            return { ...g, ratingAvg: avg, ratingCount: count };
                          }),
                        );
                        setSelectedId(p.id);
                      }
                    });
                  }}
                >
                  <Text style={styles.callTxt}>Noter 5★</Text>
                </Pressable>
              </View>
              {p.kind === 'depot_pl' || p.kind === 'pieces' || isPl ? (
                <View style={styles.plLinks}>
                  <Link href="/modules/routiers" asChild>
                    <Pressable style={styles.linkSoft}>
                      <Text style={styles.linkSoftTxt}>Infos PL / balances (M8) →</Text>
                    </Pressable>
                  </Link>
                  <Link href="/modules/gps" asChild>
                    <Pressable style={styles.linkSoft}>
                      <Text style={styles.linkSoftTxt}>GPS camion hauteur/poids (M7) →</Text>
                    </Pressable>
                  </Link>
                </View>
              ) : null}
              {p.kind === 'pieces' || p.kind === 'depot_pl' ? (
                <Link href="/modules/pieces" asChild>
                  <Pressable style={styles.linkCta}>
                    <Text style={styles.callTxt}>Commander pièces VIN (M3) →</Text>
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
  refresh: {
    backgroundColor: colors.asphalt,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginBottom: 6,
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
  chipTxt: { color: colors.slate, fontSize: 11, fontWeight: '600' },
  chipTxtOn: { color: colors.white },
  pinMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaChip: {
    backgroundColor: colors.mist,
    color: colors.slate,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  coords: { color: colors.muted, fontSize: 11, marginTop: 4 },
  waze: { backgroundColor: '#33A853', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  plLinks: { gap: 6, marginTop: 8 },
  linkCta: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
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
