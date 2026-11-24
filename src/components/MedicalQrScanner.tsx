/**
 * Camera QR scanner for Module 13 medical codes (offline envelope or UM-QR-*).
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { parseScannedQrValue } from '../services/urgence/offlineQr';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Raw QR string (UMQR1:… or UM-QR-…). */
  onScan: (raw: string) => void;
};

export function MedicalQrScanner({ visible, onClose, onScan }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setLocked(false);
      setHint(null);
      setManual('');
      if (!permission?.granted) void requestPermission();
    }, 0);
    return () => clearTimeout(t);
  }, [visible, permission?.granted, requestPermission]);

  const emit = (raw: string) => {
    const parsed = parseScannedQrValue(raw);
    if (parsed.kind === 'unknown') {
      setHint('QR non reconnu — cadrez un QR Urgence Mécanique (UM-QR-…).');
      return;
    }
    setLocked(true);
    onScan(raw.trim());
    onClose();
  };

  const onBarcode = (result: BarcodeScanningResult) => {
    if (locked) return;
    emit(result.data ?? '');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Text style={styles.title}>Scan QR médical</Text>
        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.msg}>
              Autorisation caméra requise — ou collez le code UM-QR-* ci-dessous (hors ligne OK).
            </Text>
            <Pressable style={styles.btn} onPress={() => void requestPermission()}>
              <Text style={styles.btnTxt}>Autoriser la caméra</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={locked ? undefined : onBarcode}
          />
        )}

        <Text style={styles.hint}>
          {hint ??
            (permission?.granted
              ? 'Cadrez le QR imprimé (id opaque) — fiche lue hors ligne depuis l’appareil.'
              : 'Collez UM-QR-…')}
        </Text>

        <Text style={styles.manualLbl}>Saisie / collage manuel</Text>
        <TextInput
          value={manual}
          onChangeText={(t) => {
            setManual(t);
            if (hint) setHint(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="UM-QR-…"
          placeholderTextColor="#7A8A99"
          style={styles.input}
          accessibilityLabel="Code QR médical manuel"
        />
        <Pressable style={styles.btn} onPress={() => emit(manual)} disabled={locked}>
          <Text style={styles.btnTxt}>Utiliser ce code</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text style={styles.btnGhostTxt}>Annuler</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.asphalt,
    paddingTop: 48,
    paddingHorizontal: 16,
    gap: 10,
  },
  title: { color: colors.white, fontWeight: '900', fontSize: 18 },
  camera: { flex: 1, minHeight: 220, borderRadius: 16, overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', gap: 12 },
  msg: { color: '#C5D2DE' },
  hint: { color: '#C5D2DE', fontSize: 12 },
  manualLbl: { color: '#9BB0C0', fontWeight: '700', fontSize: 12 },
  input: {
    backgroundColor: '#152033',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3A4E',
    color: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  btnTxt: { color: colors.white, fontWeight: '800' },
  btnGhostTxt: {
    color: '#9BB0C0',
    textAlign: 'center',
    paddingVertical: 10,
    fontWeight: '700',
  },
});
