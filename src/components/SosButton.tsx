import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../context/I18nContext';
import { colors } from '../theme/colors';

/**
 * Module 13 — bouton SOS toujours accessible → écran Urgence (numéros régionaux + alerte).
 * First tap opens Urgence; second tap (while open) closes/collapses it.
 * Emergency only — distinct from the bottom-right four-dot « Mise à jour » tab.
 * Sits above the tab bar: safe-area bottom + tab content (~40) + small gap.
 * Keep in sync with `app/(tabs)/_layout.tsx` TAB_CONTENT / PAD_TOP.
 */
const TAB_BAR_CONTENT = 40;
const FAB_GAP = 12;
const URGENCE_PATH = '/modules/urgence';

function isUrgenceOpen(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.includes(URGENCE_PATH));
}

export function SosButton() {
  const pathname = usePathname();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8) + TAB_BAR_CONTENT + FAB_GAP;
  const open = isUrgenceOpen(pathname);

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? t('sos.a11yClose') : t('sos.a11y')}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        onPress={() => {
          if (open) {
            // Second tap: collapse Urgence panel / leave the module.
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/mon-vehicule');
            }
            return;
          }
          // First tap: open Urgence (push keeps tab/module back path).
          router.push(URGENCE_PATH);
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
    // Avoid accidental full-width hit box if absolute layout stretches on web.
    alignSelf: 'flex-end',
    width: 58,
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
