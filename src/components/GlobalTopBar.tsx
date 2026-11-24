import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_NAME } from '../brand';
import { colors } from '../theme/colors';
import { LanguagePicker } from './LanguagePicker';

/** Reserved height below the status-bar inset for brand + FR/EN/ES squares. */
export const GLOBAL_TOP_BAR_BODY = 44;

/**
 * Persistent top overlay: English brand + FR/EN/ES squares on every page.
 * No full-width chrome strip — chips float over content.
 * Mount once from root AppShell (gates + main shell).
 */
export function GlobalTopBar() {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 0);

  return (
    <View
      style={[styles.wrap, { paddingTop: top, height: top + GLOBAL_TOP_BAR_BODY }]}
      pointerEvents="box-none"
      accessibilityRole="header"
    >
      <View style={styles.row} pointerEvents="box-none">
        <Text style={styles.brand} numberOfLines={1} accessibilityRole="header">
          {BRAND_NAME}
        </Text>
        <LanguagePicker showTitle={false} compact square />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: GLOBAL_TOP_BAR_BODY - 8,
  },
  brand: {
    flexShrink: 1,
    color: colors.ink,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.2,
    backgroundColor: 'rgba(247, 244, 239, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
