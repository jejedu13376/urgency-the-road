/**
 * Chronologie — completed trips only (route, date, destination), chronological.
 * Opened from the left-rail Chrono control (formerly Histo / “store” slot).
 */
import { Modal, FlatList, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import {
  formatTripRouteLine,
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
  // Completed only — chronological (oldest first) so the sheet reads as a timeline.
  const completed = trips
    .filter((t) => Boolean(t.endedAt))
    .slice()
    .sort((a, b) => {
      const aKey = a.endedAt ?? a.startedAt;
      const bKey = b.endedAt ?? b.startedAt;
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer chronologie" />
      <View style={styles.sheet} accessibilityLabel="Chronologie des trajets">
        <View style={styles.handle} />
        <Text style={styles.title}>Chronologie</Text>
        <Text style={styles.sub}>
          Trajets terminés · date, destination et itinéraire · enregistrés à l’arrivée
        </Text>
        {completed.length === 0 ? (
          <Text style={styles.empty}>
            Aucun trajet terminé — lancez un itinéraire et arrivez à destination pour remplir la
            chronologie.
          </Text>
        ) : (
          <FlatList
            data={completed}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => {
              const whenIso = item.endedAt ?? item.startedAt;
              const dest =
                item.destination.label ??
                `${item.destination.lat.toFixed(3)}, ${item.destination.lon.toFixed(3)}`;
              return (
                <Pressable
                  style={styles.row}
                  onPress={() => onSelectTrip(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Trajet ${formatTripRouteLine(item)}`}
                >
                  <Text style={styles.when}>{formatTripWhen(whenIso)}</Text>
                  <Text style={styles.dest} numberOfLines={2}>
                    {dest}
                  </Text>
                  <Text style={styles.route} numberOfLines={2}>
                    {formatTripRouteLine(item)}
                  </Text>
                  <Text style={styles.meta}>
                    {item.mode === 'camion' ? 'Camion' : 'Voiture'}
                    {` · ${item.distanceKm} km · ~${item.durationMin} min`}
                  </Text>
                </Pressable>
              );
            }}
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
  dest: { color: colors.ink, fontSize: 14, fontWeight: '800', lineHeight: 18, marginBottom: 2 },
  route: { color: colors.slate, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  meta: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  closeBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  closeTxt: { color: colors.muted, fontWeight: '700', fontSize: 13 },
});
