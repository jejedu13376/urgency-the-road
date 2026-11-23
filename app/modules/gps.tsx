import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { getGpsPrefs, listRoadHazards, reportHazard, saveGpsPrefs } from '../../src/services/firebase';
import type { RoadHazardDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const HAZARD_KINDS: RoadHazardDoc['kind'][] = ['danger', 'accident', 'obstacle', 'travaux', 'radar', 'autre'];

const HAZARD_LABEL: Record<RoadHazardDoc['kind'], string> = {
  danger: 'Danger',
  accident: 'Accident',
  obstacle: 'Obstacle',
  travaux: 'Travaux',
  radar: 'Radar',
  autre: 'Autre',
};

const LAW_BLURBS = {
  EU: 'EU — gabarit ponts, PTAC, interdictions PL locales, ADR si matières dangereuses.',
  NA: 'Amérique du Nord — weigh stations, bridge clearance, hazmat routes, state rules.',
  AU: 'Australie — heavy vehicle permits, height/weight corridors, rest areas.',
} as const;

/** Module 7 — double GPS PL/voiture + Maps/Waze/Apple + signalements. */
export default function GpsScreen() {
  useModuleVisit(7);
  const { profile } = useAuth();
  const { active } = useFleet();
  const isPl = active?.vehicleClass === 'poids_lourd';
  const [mode, setMode] = useState<'voiture' | 'camion'>(isPl ? 'camion' : 'voiture');
  const [dest, setDest] = useState('Gare Lille Flandres');
  const [heightM, setHeightM] = useState('4.0');
  const [widthM, setWidthM] = useState('2.55');
  const [ptacT, setPtacT] = useState('40');
  const [hazmat, setHazmat] = useState(false);
  const [regionLaw, setRegionLaw] = useState<'EU' | 'NA' | 'AU'>('EU');
  const [hazards, setHazards] = useState<RoadHazardDoc[]>([]);
  const [hazardKind, setHazardKind] = useState<RoadHazardDoc['kind']>('danger');
  const [hazardNote, setHazardNote] = useState('Signalement démo');
  const [label, setLabel] = useState<string | undefined>();
  const [hazardFilter, setHazardFilter] = useState<RoadHazardDoc['kind'] | 'all'>('all');
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const uid = profile?.uid ?? 'mock-local-user';
      const prefs = await getGpsPrefs(uid);
      setMode(prefs.data.mode);
      if (prefs.data.truckHeightM != null) setHeightM(String(prefs.data.truckHeightM));
      if (prefs.data.truckWidthM != null) setWidthM(String(prefs.data.truckWidthM));
      if (prefs.data.truckPtacT != null) setPtacT(String(prefs.data.truckPtacT));
      setHazmat(prefs.data.hazmat);
      setLabel(prefs.stubLabel);
      const hz = await listRoadHazards();
      setHazards(hz.data);
    })();
  }, [profile?.uid]);

  const open = (app: 'google' | 'waze' | 'apple') => {
    const q = encodeURIComponent(dest);
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
      waze: `https://waze.com/ul?q=${q}&navigate=yes`,
      apple: `http://maps.apple.com/?daddr=${q}`,
    };
    void Linking.openURL(urls[app]);
  };

  const persistMode = (m: 'voiture' | 'camion') => {
    setMode(m);
    const uid = profile?.uid ?? 'mock-local-user';
    void saveGpsPrefs({
      id: uid,
      ownerUid: uid,
      mode: m,
      truckHeightM: Number(heightM) || 4,
      truckWidthM: Number(widthM) || 2.55,
      truckPtacT: Number(ptacT) || 40,
      hazmat,
      preferApps: ['google', 'waze', 'apple'],
      updatedAt: new Date().toISOString(),
    });
  };

  const saveTruck = () => persistMode('camion');

  const visibleHazards =
    hazardFilter === 'all' ? hazards : hazards.filter((h) => h.kind === hazardFilter);

  return (
    <>
      <Stack.Screen options={{ title: 'Double GPS' }} />
      <Screen title="Navigation" subtitle="Module 7 — PL & voiture · transfert Maps / Waze / Apple">
        <BackendStatusBanner />
        <StubBanner text={label ?? 'STUB GPS — pas de graphe ponts/PTAC live ; transfert apps réel'} />

        <Card title="Mode de navigation">
          <View style={styles.row}>
            <Pressable style={[styles.mode, mode === 'voiture' && styles.on]} onPress={() => persistMode('voiture')}>
              <Text style={styles.modeTxt}>Voiture normale</Text>
              <Text style={styles.modeSub}>Itinéraire rapide</Text>
            </Pressable>
            <Pressable style={[styles.mode, mode === 'camion' && styles.on]} onPress={() => persistMode('camion')}>
              <Text style={styles.modeTxt}>Poids lourd</Text>
              <Text style={styles.modeSub}>Hauteur · PTAC · ADR</Text>
            </Pressable>
          </View>
          <Text style={styles.eta}>
            {mode === 'camion'
              ? `ETA PL mock ${22 + (hazmat ? 8 : 0)} min · gabarit ${heightM} m · PTAC ${ptacT} t${hazmat ? ' · ADR' : ''}`
              : 'ETA voiture mock 18 min · 12,4 km — pas de filtre gabarit'}
          </Text>
          {isPl && mode === 'voiture' ? (
            <Text style={styles.warn}>Véhicule actif = PL — basculez en mode camion pour les contraintes légales.</Text>
          ) : null}
          {mode === 'camion' ? (
            <View style={styles.truckBox}>
              <Text style={styles.section}>Contraintes camion (éditables)</Text>
              <View style={styles.fieldRow}>
                <Field label="Hauteur (m)" value={heightM} onChange={setHeightM} />
                <Field label="Largeur (m)" value={widthM} onChange={setWidthM} />
                <Field label="PTAC (t)" value={ptacT} onChange={setPtacT} />
              </View>
              <Pressable style={[styles.chip, hazmat && styles.chipOn]} onPress={() => setHazmat((h) => !h)}>
                <Text style={[styles.chipTxt, hazmat && styles.chipTxtOn]}>
                  Matières dangereuses (ADR) : {hazmat ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
              <Text style={styles.section}>Loi camionnage (aperçu)</Text>
              <View style={styles.row}>
                {(['EU', 'NA', 'AU'] as const).map((r) => (
                  <Pressable key={r} style={[styles.chip, regionLaw === r && styles.chipOn]} onPress={() => setRegionLaw(r)}>
                    <Text style={[styles.chipTxt, regionLaw === r && styles.chipTxtOn]}>{r}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hint}>{LAW_BLURBS[regionLaw]}</Text>
              <Pressable style={styles.send} onPress={saveTruck}>
                <Text style={styles.sendTxt}>Enregistrer préférences PL</Text>
              </Pressable>
              <Link href="/modules/routiers" asChild>
                <Pressable style={styles.linkSoft}>
                  <Text style={styles.linkSoftTxt}>Balances & dépôts PL (M8) →</Text>
                </Pressable>
              </Link>
            </View>
          ) : (
            <Text style={styles.hint}>Itinéraire rapide standard (mock ETA 18 min) — pas de filtre gabarit.</Text>
          )}
        </Card>

        <Card title="Destination & transfert">
          <TextInput
            value={dest}
            onChangeText={setDest}
            style={styles.input}
            placeholder="Adresse ou lieu"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.section}>Envoyer la trajectoire</Text>
          <View style={styles.row}>
            <Pressable style={[styles.send, { backgroundColor: colors.signal }]} onPress={() => open('google')}>
              <Text style={styles.sendTxt}>Google Maps</Text>
            </Pressable>
            <Pressable style={[styles.send, { backgroundColor: colors.garage }]} onPress={() => open('waze')}>
              <Text style={styles.sendTxt}>Waze</Text>
            </Pressable>
            <Pressable style={[styles.send, { backgroundColor: colors.slate }]} onPress={() => open('apple')}>
              <Text style={styles.sendTxt}>Apple Plans</Text>
            </Pressable>
          </View>
        </Card>

        <Card title="Signalements routiers (temps réel mock)">
          <Text style={styles.hint}>Dangers, accidents, obstacles, travaux, radars — visibles par les autres conducteurs.</Text>
          <View style={styles.row}>
            <Pressable style={[styles.chip, hazardFilter === 'all' && styles.chipOn]} onPress={() => setHazardFilter('all')}>
              <Text style={[styles.chipTxt, hazardFilter === 'all' && styles.chipTxtOn]}>Tous ({hazards.length})</Text>
            </Pressable>
            {HAZARD_KINDS.map((k) => (
              <Pressable key={`f-${k}`} style={[styles.chip, hazardFilter === k && styles.chipOn]} onPress={() => setHazardFilter(k)}>
                <Text style={[styles.chipTxt, hazardFilter === k && styles.chipTxtOn]}>{HAZARD_LABEL[k]}</Text>
              </Pressable>
            ))}
          </View>
          {visibleHazards.map((h) => (
            <View key={h.id} style={styles.hazardRow}>
              <Text style={styles.hazardKind}>{HAZARD_LABEL[h.kind]}</Text>
              <Text style={styles.hint}>
                {h.note ?? '—'} · {h.lat.toFixed(3)}, {h.lon.toFixed(3)}
              </Text>
            </View>
          ))}
          <Text style={styles.section}>Nouveau signalement</Text>
          <View style={styles.row}>
            {HAZARD_KINDS.map((k) => (
              <Pressable key={k} style={[styles.chip, hazardKind === k && styles.chipOn]} onPress={() => setHazardKind(k)}>
                <Text style={[styles.chipTxt, hazardKind === k && styles.chipTxtOn]}>{HAZARD_LABEL[k]}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={hazardNote}
            onChangeText={setHazardNote}
            style={styles.input}
            placeholder="Note (ex. voie fermée)"
            placeholderTextColor={colors.muted}
          />
          <Pressable
            style={styles.send}
            onPress={() =>
              void reportHazard({
                reporterUid: profile?.uid ?? 'mock-local-user',
                kind: hazardKind,
                lat: 50.63,
                lon: 3.06,
                note: hazardNote || HAZARD_LABEL[hazardKind],
              }).then((r) => {
                setHazards((prev) => [r.data, ...prev]);
                setReportMsg(r.stubLabel ?? 'Signalement enregistré (mock)');
              })
            }
          >
            <Text style={styles.sendTxt}>Publier le signalement</Text>
          </Pressable>
          {reportMsg ? <Text style={styles.ok}>{reportMsg}</Text> : null}
        </Card>
      </Screen>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" style={styles.fieldInput} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mode: { flex: 1, minWidth: 120, padding: 12, borderRadius: 10, backgroundColor: colors.mist, alignItems: 'center' },
  on: { backgroundColor: colors.signalSoft, borderWidth: 1, borderColor: colors.signal },
  modeTxt: { fontWeight: '800', color: colors.ink },
  modeSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  eta: { fontWeight: '700', color: colors.signal, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  warn: { color: colors.warn, fontWeight: '700', fontSize: 12 },
  ok: { color: colors.garage, fontWeight: '700', fontSize: 12 },
  truckBox: { gap: 8 },
  fieldRow: { flexDirection: 'row', gap: 8 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.slate },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 8,
    backgroundColor: colors.mist,
    color: colors.ink,
  },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, backgroundColor: colors.mist, color: colors.ink },
  section: { fontWeight: '800', color: colors.ink },
  send: { backgroundColor: colors.asphalt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  sendTxt: { color: colors.white, fontWeight: '700', fontSize: 12 },
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
  hazardRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  hazardKind: { fontWeight: '800', color: colors.signal, fontSize: 12 },
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
