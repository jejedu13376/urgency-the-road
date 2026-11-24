/**
 * Local QR image for Module 13 — generated on-device (react-native-qrcode-svg).
 * No network / no server image API.
 */
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../theme/colors';

type Props = {
  /** Full offline envelope or opaque UM-QR-* value. */
  value: string;
  size?: number;
  label?: string;
};

export function MedicalQrCode({ value, size = 200, label }: Props) {
  if (!value.trim()) {
    return (
      <View style={styles.empty} accessibilityLabel="QR indisponible">
        <Text style={styles.emptyTxt}>QR indisponible — abonné + fiche requis</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityLabel="QR médical personnel">
      <View style={styles.frame}>
        <QRCode
          value={value}
          size={size}
          color="#0B1220"
          backgroundColor="#FFFFFF"
          ecl="M"
        />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, marginVertical: 8 },
  frame: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: {
    color: colors.signal,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  empty: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
    marginVertical: 8,
  },
  emptyTxt: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
