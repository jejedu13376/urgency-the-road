import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { colors } from '../theme/colors';

type Props = { visible: boolean; onClose: () => void; onVin: (vin: string) => void };

export function VinCameraScanner({ visible, onClose, onVin }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLocked(false);
      setHint(null);
      if (!permission?.granted) void requestPermission();
    }
  }, [visible, permission?.granted, requestPermission]);

  const onBarcode = (result: BarcodeScanningResult) => {
    if (locked) return;
    const raw = (result.data ?? '').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    if (raw.length < 11) {
      setHint(`Code trop court (${raw.length}) — VIN 11–17 car.`);
      return;
    }
    setLocked(true);
    onVin(raw.slice(0, 17));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Text style={styles.title}>Scan VIN caméra</Text>
        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.msg}>Autorisation caméra requise.</Text>
            <Pressable style={styles.btn} onPress={() => void requestPermission()}>
              <Text style={styles.btnTxt}>Autoriser</Text>
            </Pressable>
            <Pressable onPress={onClose}><Text style={styles.btnGhostTxt}>Fermer</Text></Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code39', 'code128', 'datamatrix', 'pdf417'] }}
              onBarcodeScanned={locked ? undefined : onBarcode}
            />
            <Text style={styles.hint}>{hint ?? 'Cadrez le code-barres / QR VIN.'}</Text>
            <Pressable onPress={onClose}><Text style={styles.btnGhostTxt}>Annuler</Text></Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.asphalt, paddingTop: 48, paddingHorizontal: 16, gap: 12 },
  title: { color: colors.white, fontWeight: '900', fontSize: 18 },
  camera: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', gap: 12 },
  msg: { color: '#C5D2DE' },
  hint: { color: '#C5D2DE', fontSize: 12 },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnTxt: { color: colors.white, fontWeight: '800' },
  btnGhostTxt: { color: colors.white, fontWeight: '700', textAlign: 'center', padding: 12 },
});
