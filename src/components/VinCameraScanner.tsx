import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { normalizeVin } from '../services/vin/vinNormalize';
import { colors } from '../theme/colors';

type Props = { visible: boolean; onClose: () => void; onVin: (vin: string) => void };

export function VinCameraScanner({ visible, onClose, onVin }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (visible) {
      setLocked(false);
      setHint(null);
      setManual('');
      if (!permission?.granted) void requestPermission();
    }
  }, [visible, permission?.granted, requestPermission]);

  const emit = (raw: string) => {
    const vin = normalizeVin(raw);
    if (vin.length < 11) {
      setHint(`VIN trop court (${vin.length}) — 11 à 17 caractères.`);
      return;
    }
    setLocked(true);
    onVin(vin.slice(0, 17));
    onClose();
  };

  const onBarcode = (result: BarcodeScanningResult) => {
    if (locked) return;
    emit(result.data ?? '');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Text style={styles.title}>Scan VIN caméra</Text>
        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.msg}>Autorisation caméra requise — ou saisie manuelle ci-dessous.</Text>
            <Pressable style={styles.btn} onPress={() => void requestPermission()}>
              <Text style={styles.btnTxt}>Autoriser la caméra</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code39', 'code128', 'datamatrix', 'pdf417'] }}
              onBarcodeScanned={locked ? undefined : onBarcode}
            />
            <Text style={styles.hint}>{hint ?? 'Cadrez le code-barres / QR VIN (plaque, carte grise).'}</Text>
          </>
        )}

        <Text style={styles.manualLbl}>Saisie manuelle (si scan illisible)</Text>
        <TextInput
          value={manual}
          onChangeText={setManual}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="VF1RJA00067000001"
          placeholderTextColor="#7A8A99"
          style={styles.input}
          accessibilityLabel="VIN manuel"
        />
        <Pressable style={styles.btn} onPress={() => emit(manual)} disabled={locked}>
          <Text style={styles.btnTxt}>Valider ce VIN</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text style={styles.btnGhostTxt}>Annuler</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.asphalt, paddingTop: 48, paddingHorizontal: 16, gap: 10 },
  title: { color: colors.white, fontWeight: '900', fontSize: 18 },
  camera: { flex: 1, minHeight: 220, borderRadius: 16, overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', gap: 12 },
  msg: { color: '#C5D2DE' },
  hint: { color: '#C5D2DE', fontSize: 12 },
  manualLbl: { color: '#C5D2DE', fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#3A4A5A',
    borderRadius: 10,
    padding: 12,
    color: colors.white,
    letterSpacing: 1,
    fontWeight: '700',
  },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnTxt: { color: colors.white, fontWeight: '800' },
  btnGhostTxt: { color: colors.white, fontWeight: '700', textAlign: 'center', padding: 12 },
});
