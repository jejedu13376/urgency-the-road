/**
 * Street View peek — Google Street View Static image when key present.
 */
import { Image, Modal, Pressable, StyleSheet, Text, View, Platform, Linking } from 'react-native';
import {
  isStreetViewConfigured,
  streetViewEmbedUrl,
  streetViewStaticUrl,
} from '../../services/geo/streetViewUrl';
import { colors } from '../../theme/colors';

type Props = {
  visible: boolean;
  lat: number | null;
  lon: number | null;
  onClose: () => void;
};

export function GpsStreetViewModal({ visible, lat, lon, onClose }: Props) {
  const ready = lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon);
  const configured = isStreetViewConfigured();
  const staticUrl = ready ? streetViewStaticUrl(lat!, lon!) : null;
  const embed = ready ? streetViewEmbedUrl(lat!, lon!) : null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Street View</Text>
          <Text style={styles.coords}>
            {ready ? `${lat!.toFixed(5)}, ${lon!.toFixed(5)}` : '—'}
          </Text>
          {!configured ? (
            <Text style={styles.hint}>
              Ajoutez EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (ou Places) + Street View Static API pour l’image.
            </Text>
          ) : null}
          {staticUrl ? (
            <Image
              source={{ uri: staticUrl }}
              style={styles.img}
              resizeMode="cover"
              accessibilityLabel="Street View static"
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderTxt}>Aperçu indisponible</Text>
            </View>
          )}
          <View style={styles.actions}>
            {embed ? (
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  void Linking.openURL(embed);
                }}
              >
                <Text style={styles.secondaryTxt}>Ouvrir</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.primary} onPress={onClose}>
              <Text style={styles.primaryTxt}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,24,32,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
  },
  title: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  coords: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 2, marginBottom: 10 },
  hint: { color: colors.slate, fontSize: 11, fontWeight: '600', marginBottom: 8, lineHeight: 15 },
  img: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.mist,
  },
  placeholder: {
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTxt: { color: colors.muted, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  secondary: {
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  secondaryTxt: { color: colors.slate, fontWeight: '700' },
  primary: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
});
