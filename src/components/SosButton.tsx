import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

/**
 * Module 13 — bouton SOS toujours accessible → écran Urgence (numéros régionaux + alerte).
 * Sits above the tab bar: safe-area bottom + tab content (~40) + small gap.
 * Keep in sync with `app/(tabs)/_layout.tsx` TAB_CONTENT / PAD_TOP.
 */
const TAB_BAR_CONTENT = 40;
const FAB_GAP = 12;

export function SosButton() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8) + TAB_BAR_CONTENT + FAB_GAP;

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="SOS Urgence médicale — ouvrir le module Urgence"
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        onPress={() => {
          // Already on Urgence → no-op (avoid stacking a duplicate).
          if (pathname?.includes('/modules/urgence')) return;
          // push (not replace) so tab/module history keeps a back path.
          router.push('/modules/urgence');
        }}
      >
        <Text style={styles.txt} allowFontScaling={false}>
          SOS
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 14,
    zIndex: 30,
  },
  btn: {
    backgroundColor: colors.danger,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    elevation: 4,
  },
  txt: { color: colors.white, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
});
