import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function StubBanner({ text }: { text: string }) {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={styles.tag}>STUB</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.warnSoft,
    borderColor: colors.warn,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  tag: {
    fontWeight: '800',
    color: colors.ink,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  text: { flex: 1, color: colors.slate, fontSize: 12, lineHeight: 17 },
});
