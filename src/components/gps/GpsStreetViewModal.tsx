/**
 * Street View — interactive peek (embed) when Maps key present; static fallback.
 * Shown only after explicit Street View ON + road tap (map HTML).
 */
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
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

/** RN WebView typings collapse under strict TS — cast like GpsFullMap. */
const PeekWebView = RNWebView as unknown as React.ComponentType<{
  source?: { uri: string } | { html: string; baseUrl?: string };
  style?: object;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  allowsInlineMediaPlayback?: boolean;
  setSupportMultipleWindows?: boolean;
  originWhitelist?: string[];
}>;

export function GpsStreetViewModal({ visible, lat, lon, onClose }: Props) {
  const ready = lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon);
  const configured = isStreetViewConfigured();
  const embed = ready ? streetViewEmbedUrl(lat!, lon!) : null;
  const staticUrl = ready ? streetViewStaticUrl(lat!, lon!) : null;

  const html =
    ready && configured && staticUrl
      ? `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>html,body{margin:0;height:100%;background:#111}img{width:100%;height:100%;object-fit:cover}</style></head>
<body><img src="${staticUrl.replace(/"/g, '&quot;')}" alt="Street View"/></body></html>`
      : null;

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
              Ajoutez EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (ou Places) + Street View Static API pour
              l’aperçu. Déplacez-vous dans la vue quand la clé est active.
            </Text>
          ) : null}
          {ready && embed && configured ? (
            <PeekWebView
              source={{ uri: embed }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              setSupportMultipleWindows={false}
              originWhitelist={['*']}
            />
          ) : ready && html ? (
            <PeekWebView
              source={{ html, baseUrl: 'https://maps.googleapis.com' }}
              style={styles.webview}
              javaScriptEnabled
              originWhitelist={['*']}
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderTxt}>Aperçu indisponible</Text>
            </View>
          )}
          <View style={styles.actions}>
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
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    maxHeight: '88%',
  },
  title: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  coords: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 8,
  },
  hint: {
    color: colors.slate,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 15,
  },
  webview: {
    width: '100%',
    height: Platform.OS === 'web' ? 320 : 360,
    borderRadius: 12,
    overflow: 'hidden',
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
  primary: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
});
