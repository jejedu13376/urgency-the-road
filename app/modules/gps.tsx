import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { LazyGpsFullMap } from '../../src/components/gps/LazyGpsFullMap';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/context/I18nContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listRoadHazards, reportHazard } from '../../src/services/firebase/hazardsService';
import { getDeviceCoords } from '../../src/services/geo/deviceLocation';
import type { RoadHazardDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';
import { PressScale } from '../../src/theme/motion';

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
        <LazyGpsFullMap />
        <PressScale style={styles.hazBtn} onPress={() => setSheet(true)}>
          <Text style={styles.hazTxt}>{t('gpsScreen.hazards')}</Text>
        </PressScale>
      </View>

      <Modal visible={sheet} animationType="slide" transparent onRequestClose={() => setSheet(false)}>
        <View style={styles.sheetWrap}>
          <Pressable style={styles.sheetDismiss} onPress={() => setSheet(false)} accessibilityLabel={t('close')} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t('gpsScreen.hazardsTitle')}</Text>
            <Text style={styles.hint}>{t('gpsScreen.hazardsHint')}</Text>
            <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
              {hazards.slice(0, 8).map((h) => (
                <Text key={h.id} style={styles.hazardLine}>
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
              <PressScale
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
              </PressScale>
              {reportMsg ? <Text style={styles.ok}>{reportMsg}</Text> : null}
              <Pressable style={styles.close} onPress={() => setSheet(false)}>
                <Text style={styles.closeTxt}>{t('close')}</Text>
              </Pressable>
            </ScrollView>
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
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    shadowColor: '#101820',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  hazTxt: { fontWeight: '800', color: colors.ink, fontSize: 14 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,32,0.42)' },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 8,
    maxHeight: '72%',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginBottom: 8,
  },
  sheetScroll: { maxHeight: '100%' },
  sheetTitle: { fontWeight: '900', fontSize: 22, color: colors.ink, lineHeight: 28 },
  hint: { color: colors.slate, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  hazardLine: { color: colors.slate, fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.mist,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { color: colors.slate, fontSize: 14, fontWeight: '700' },
  chipTxtOn: { color: colors.white },
  input: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    minHeight: 48,
  },
  send: {
    backgroundColor: colors.asphalt,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  sendTxt: { color: colors.white, fontWeight: '800', fontSize: 16 },
  ok: { color: colors.garage, fontWeight: '700', fontSize: 14, marginTop: 6 },
  close: { padding: 12, alignItems: 'center' },
  closeTxt: { color: colors.signal, fontWeight: '800', fontSize: 15 },
});
