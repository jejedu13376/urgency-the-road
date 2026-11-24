/**
 * Front-camera drowsiness card — 3s continuous closed eyes → loud audible alert.
 * Eye samples are fed into drowsinessMonitor (on-device face pipeline / QA hold).
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Card } from './Card';
import {
  DROWSINESS_CLOSED_EYES_MS,
  createDrowsinessMonitorState,
  ingestDrowsinessSample,
  speakDrowsinessAlert,
  type DrowsinessMonitorState,
} from '../services/urgence/drowsinessMonitor';
import { colors } from '../theme/colors';

export function DrowsinessMonitorCard() {
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const [holdingClosed, setHoldingClosed] = useState(false);
  const [state, setState] = useState<DrowsinessMonitorState>(() => createDrowsinessMonitorState());
  const [status, setStatus] = useState('Caméra frontale — détection somnolence (3 s yeux fermés)');
  const speakingRef = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const { state: next, crossedThreshold } = ingestDrowsinessSample(stateRef.current, {
        eyesClosed: holdingClosed,
        atMs: Date.now(),
      });
      stateRef.current = next;
      setState(next);
      if (crossedThreshold && !speakingRef.current) {
        speakingRef.current = true;
        setStatus('ALERTE SOMNOLENCE — alerte sonore');
        void speakDrowsinessAlert().finally(() => {
          speakingRef.current = false;
        });
      }
    }, 100);
    return () => clearInterval(id);
  }, [active, holdingClosed]);

  return (
    <Card title="Somnolence — caméra frontale">
      <Text style={styles.meta}>
        Seuil exact : {DROWSINESS_CLOSED_EYES_MS / 1000} s yeux fermés en continu → alerte vocale
        forte (pas visuelle seule).
      </Text>
      {!permission?.granted ? (
        <Pressable style={styles.btn} onPress={() => void requestPermission()}>
          <Text style={styles.btnTxt}>Autoriser la caméra (face / somnolence)</Text>
        </Pressable>
      ) : (
        <>
          {active ? (
            <CameraView style={styles.camera} facing="front" />
          ) : (
            <View style={styles.cameraOff}>
              <Text style={styles.meta}>Prévisualisation off</Text>
            </View>
          )}
          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={() => setActive((v) => !v)}>
              <Text style={styles.btnTxt}>{active ? 'Arrêter surveillance' : 'Démarrer'}</Text>
            </Pressable>
            <Pressable
              style={[styles.btnDark, holdingClosed && styles.btnDanger]}
              onPressIn={() => setHoldingClosed(true)}
              onPressOut={() => setHoldingClosed(false)}
            >
              <Text style={styles.btnTxt}>
                {holdingClosed ? 'Yeux fermés…' : 'Maintenir = yeux fermés'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
      <Text style={styles.status}>
        {status} · streak {Math.round(state.closedStreakMs)} ms
        {state.alerted ? ' · ALERTÉ' : ''}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  status: { color: colors.ink, fontWeight: '700', fontSize: 12, marginTop: 8 },
  camera: { height: 160, borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  cameraOff: {
    height: 80,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: {
    flex: 1,
    backgroundColor: colors.signal,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  btnDark: {
    flex: 1,
    backgroundColor: colors.asphalt,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  btnDanger: { backgroundColor: colors.danger },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 12 },
});
