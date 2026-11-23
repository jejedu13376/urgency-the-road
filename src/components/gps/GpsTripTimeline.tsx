/**
 * Chronological trip history — date, origin/dest, distance, duration.
 * Tap a row → details + replay route on map.
 */
import { Modal, FlatList, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import {
  formatTripSummaryLine,
  formatTripWhen,
  type GpsTripRecord,
} from '../../services/prefs/gpsTripHistory';
import { colors } from '../../theme/colors';

type Props = {
  visible: boolean;
  trips: GpsTripRecord[];
  onClose: () => void;
  onSelectTrip: (trip: GpsTripRecord) => void;
};

export function GpsTripTimeline({ visible, trips, onClose, onSelectTrip }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer historique" />
      <View style={styles.sheet} accessibilityLabel="Historique des trajets">
        <View style={styles.handle} />
        <Text style={styles.title}>Historique des trajets</Text>
        <Text style={styles.sub}>
          Enregistré à chaque démarrage d’itinéraire · stockage local appareil
        </Text>
        {trips.length === 0 ? (
          <Text style={styles.empty}>Aucun trajet encore — démarrez un itinéraire pour remplir la liste.</Text>
        ) : (
          <FlatList
            data={trips}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => onSelectTrip(item)}
                accessibilityRole="button"
                accessibilityLabel={`Trajet ${formatTripSummaryLine(item)}`}
              >
                <Text style={styles.when}>{formatTripWhen(item.startedAt)}</Text>
                <Text style={styles.summary} numberOfLines={2}>
                  {formatTripSummaryLine(item)}
                </Text>
                <Text style={styles.meta}>
                  {item.mode === 'camion' ? 'Camion' : 'Voiture'}
                  {item.endedAt ? ' · terminé' : ' · démarré'}
                  {item.coords.length ? ` · ${item.coords.length} pts route` : ''}
                </Text>
              </Pressable>
            )}
          />
        )}
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeTxt}>Fermer</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(16,24,32,0.35)' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 10,
  },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  sub: { color: colors.muted, fontSize: 11, fontWeight: '600', marginBottom: 12 },
  empty: { color: colors.slate, fontSize: 13, fontWeight: '600', lineHeight: 18, marginVertical: 16 },
  list: { maxHeight: 420 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  when: { color: colors.signal, fontSize: 11, fontWeight: '800', marginBottom: 3 },
  summary: { color: colors.ink, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  meta: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  closeBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  closeTxt: { color: colors.muted, fontWeight: '700', fontSize: 13 },
});
