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
import { useI18n } from '../../src/context/I18nContext';
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

/**
 * Module 7 — même carte GPS plein écran (voiture/camion) que l’onglet Carte.
 * Signalements routiers en feuille modale (hors surface carte).
 */
export default function GpsScreen() {
  useModuleVisit(7);
  const { profile } = useAuth();
  const { t } = useI18n();
  const [sheet, setSheet] = useState(false);
  const [hazards, setHazards] = useState<RoadHazardDoc[]>([]);
  const [hazardKind, setHazardKind] = useState<RoadHazardDoc['kind']>('danger');
  const [hazardNote, setHazardNote] = useState('');
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  const hazardLabel = (k: RoadHazardDoc['kind']) => {
    switch (k) {
      case 'danger':
        return t('gpsScreen.kindDanger');
      case 'accident':
        return t('gpsScreen.kindAccident');
      case 'obstacle':
        return t('gpsScreen.kindObstacle');
      case 'travaux':
        return t('gpsScreen.kindTravaux');
      case 'radar':
        return t('gpsScreen.kindRadar');
      default:
        return t('gpsScreen.kindAutre');
    }
  };

  useEffect(() => {
    void (async () => {
      const hz = await listRoadHazards();
      if (hz.ok === false && (!hz.data || hz.data.length === 0)) setHazards([]);
      else setHazards(hz.data ?? []);
    })();
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: t('gpsScreen.title') }} />
      <View style={styles.fill}>
        <GpsFullMap />
        <Pressable style={styles.hazBtn} onPress={() => setSheet(true)}>
          <Text style={styles.hazTxt}>{t('gpsScreen.hazards')}</Text>
        </Pressable>
      </View>

      <Modal visible={sheet} animationType="slide" transparent onRequestClose={() => setSheet(false)}>
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('gpsScreen.hazardsTitle')}</Text>
            <Text style={styles.hint}>{t('gpsScreen.hazardsHint')}</Text>
            {hazards.slice(0, 8).map((h) => (
              <Text key={h.id} style={styles.hint}>
                · {hazardLabel(h.kind)} — {h.note ?? '—'}
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
                    {hazardLabel(k)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={hazardNote}
              onChangeText={setHazardNote}
              style={styles.input}
              placeholder={t('note')}
              placeholderTextColor={colors.muted}
            />
            <Pressable
              style={styles.send}
              onPress={() =>
                void (async () => {
                  const fresh = await getDeviceCoords({ allowFallback: false });
                  if (!fresh.ok || fresh.data?.source !== 'device') {
                    setReportMsg(t('gpsScreen.needDeviceGps'));
                    return;
                  }
                  if (!profile?.uid) {
                    setReportMsg(t('gpsScreen.needLogin'));
                    return;
                  }
                  const r = await reportHazard({
                    reporterUid: profile.uid,
                    kind: hazardKind,
                    lat: fresh.data.lat,
                    lon: fresh.data.lon,
                    note: hazardNote || hazardLabel(hazardKind),
                  });
                  if (r.ok === false) {
                    setReportMsg(r.stubLabel ?? t('gpsScreen.refused'));
                    return;
                  }
                  setHazards((prev) => [r.data, ...prev]);
                  setReportMsg(t('gpsScreen.published'));
                })()
              }
            >
              <Text style={styles.sendTxt}>{t('publish')}</Text>
            </Pressable>
            {reportMsg ? <Text style={styles.ok}>{reportMsg}</Text> : null}
            <Pressable style={styles.close} onPress={() => setSheet(false)}>
              <Text style={styles.closeTxt}>{t('close')}</Text>
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
