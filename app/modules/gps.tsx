import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { GpsFullMap } from '../../src/components/gps/GpsFullMap';
import { useAuth } from '../../src/context/AuthContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listRoadHazards, reportHazard } from '../../src/services/firebase';
import { getDeviceCoords } from '../../src/services/geo/deviceLocation';
import type { RoadHazardDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const HAZARD_KINDS: RoadHazardDoc['kind'][] = [
  'danger',
  'accident',
  'obstacle',
  'travaux',
  'radar',
  'autre',
];

const HAZARD_LABEL: Record<RoadHazardDoc['kind'], string> = {
  danger: 'Danger',
  accident: 'Accident',
  obstacle: 'Obstacle',
  travaux: 'Travaux',
  radar: 'Radar',
  autre: 'Autre',
};

/**
 * Module 7 — même carte GPS plein écran (voiture/camion) que l’onglet Carte.
 * Signalements routiers en feuille modale (hors surface carte).
 */
export default function GpsScreen() {
  useModuleVisit(7);
  const { profile } = useAuth();
  const [sheet, setSheet] = useState(false);
  const [hazards, setHazards] = useState<RoadHazardDoc[]>([]);
  const [hazardKind, setHazardKind] = useState<RoadHazardDoc['kind']>('danger');
  const [hazardNote, setHazardNote] = useState('');
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const hz = await listRoadHazards();
      if (hz.ok === false && (!hz.data || hz.data.length === 0)) setHazards([]);
      else setHazards(hz.data ?? []);
    })();
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Double GPS' }} />
      <View style={styles.fill}>
        <GpsFullMap />
        <Pressable style={styles.hazBtn} onPress={() => setSheet(true)}>
          <Text style={styles.hazTxt}>Signalements</Text>
        </Pressable>
      </View>

      <Modal visible={sheet} animationType="slide" transparent onRequestClose={() => setSheet(false)}>
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Signalements routiers</Text>
            <Text style={styles.hint}>Hors carte — GPS appareil requis pour publier.</Text>
            {hazards.slice(0, 8).map((h) => (
              <Text key={h.id} style={styles.hint}>
                · {HAZARD_LABEL[h.kind]} — {h.note ?? '—'}
              </Text>
            ))}
            <View style={styles.row}>
              {HAZARD_KINDS.map((k) => (
                <Pressable
                  key={k}
                  style={[styles.chip, hazardKind === k && styles.chipOn]}
                  onPress={() => setHazardKind(k)}
                >
                  <Text style={[styles.chipTxt, hazardKind === k && styles.chipTxtOn]}>
                    {HAZARD_LABEL[k]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={hazardNote}
              onChangeText={setHazardNote}
              style={styles.input}
              placeholder="Note"
              placeholderTextColor={colors.muted}
            />
            <Pressable
              style={styles.send}
              onPress={() =>
                void (async () => {
                  const fresh = await getDeviceCoords({ allowFallback: false });
                  if (!fresh.ok || fresh.data?.source !== 'device') {
                    setReportMsg('Signalement refusé — GPS appareil requis.');
                    return;
                  }
                  if (!profile?.uid) {
                    setReportMsg('Connectez-vous (M15) pour publier.');
                    return;
                  }
                  const r = await reportHazard({
                    reporterUid: profile.uid,
                    kind: hazardKind,
                    lat: fresh.data.lat,
                    lon: fresh.data.lon,
                    note: hazardNote || HAZARD_LABEL[hazardKind],
                  });
                  if (r.ok === false) {
                    setReportMsg(r.stubLabel ?? 'Signalement refusé');
                    return;
                  }
                  setHazards((prev) => [r.data, ...prev]);
                  setReportMsg('Signalement publié');
                })()
              }
            >
              <Text style={styles.sendTxt}>Publier</Text>
            </Pressable>
            {reportMsg ? <Text style={styles.ok}>{reportMsg}</Text> : null}
            <Pressable style={styles.close} onPress={() => setSheet(false)}>
              <Text style={styles.closeTxt}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.asphalt },
  hazBtn: {
    position: 'absolute',
    left: 12,
    bottom: 100,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 20,
  },
  hazTxt: { fontWeight: '800', color: colors.ink, fontSize: 12 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 8,
    maxHeight: '70%',
  },
  sheetTitle: { fontWeight: '800', fontSize: 16, color: colors.ink },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
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
  chipTxt: { color: colors.slate, fontSize: 12, fontWeight: '600' },
  chipTxtOn: { color: colors.white },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
  },
  send: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  sendTxt: { color: colors.white, fontWeight: '700' },
  ok: { color: colors.garage, fontWeight: '700', fontSize: 12 },
  close: { padding: 10, alignItems: 'center' },
  closeTxt: { color: colors.signal, fontWeight: '800' },
});
