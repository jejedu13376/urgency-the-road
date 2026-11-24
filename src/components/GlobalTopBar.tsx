import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_NAME } from '../brand';
import { colors } from '../theme/colors';
import { LanguagePicker } from './LanguagePicker';

/** Visible bar height below the status-bar inset (chips + padding). */
export const GLOBAL_TOP_BAR_BODY = 44;

/**
 * Persistent top chrome: English brand + FR/EN/ES squares on every page.
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
      <View style={styles.row}>
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
    zIndex: 40,
    backgroundColor: colors.asphalt,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3542',
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
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
