import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  EMERGENCY_NUMBERS,
  type EmergencyRegionId,
} from '../services/urgence/emergencyNumbers';
import { colors } from '../theme/colors';

type Props = {
  /** Highlighted suggestion — all numbers remain visible and tappable. */
  suggestedId: EmergencyRegionId;
  /** Compact layout for nested previews. */
  compact?: boolean;
};

/** Side-by-side / wrap list of regional emergency dial numbers. */
export function EmergencyDialList({ suggestedId, compact }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.legend}>
        Choisissez un numéro — suggestion locale mise en avant, toutes les options restent
        disponibles.
      </Text>
      <View style={styles.grid}>
        {EMERGENCY_NUMBERS.map((opt) => {
          const suggested = opt.id === suggestedId;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              accessibilityLabel={`Appeler ${opt.number} — ${opt.regionLabel}${
                suggested ? ' (suggéré)' : ''
              }`}
              accessibilityState={{ selected: suggested }}
              style={({ pressed }) => [
                styles.btn,
                compact && styles.btnCompact,
                suggested ? styles.btnSuggested : styles.btnOther,
                pressed && { opacity: 0.88 },
              ]}
              onPress={() => void Linking.openURL(`tel:${opt.number}`)}
            >
              {suggested ? <Text style={styles.badge}>Suggéré</Text> : null}
              <Text style={styles.number}>{opt.number}</Text>
              <Text style={styles.region}>{opt.regionLabel}</Text>
              {!compact ? <Text style={styles.hint}>{opt.hint}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 8 },
  legend: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 2,
    gap: 2,
  },
  btnCompact: { minWidth: 120, paddingVertical: 10 },
  btnSuggested: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  btnOther: {
    backgroundColor: colors.asphalt,
    borderColor: colors.line,
  },
  badge: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.95,
  },
  number: { color: colors.white, fontWeight: '900', fontSize: 22, letterSpacing: 0.5 },
  region: { color: colors.white, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.78)', fontSize: 10, textAlign: 'center', marginTop: 2 },
});
