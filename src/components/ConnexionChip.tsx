import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { belowGlobalTopBar, CHROME_GAP } from '../chromeInsets';
import { colors } from '../theme/colors';

/** Fixed chrome width — weather sits below this row (see WeatherBanner). */
export const CONNEXION_CHIP_HEIGHT = 36;

/**
 * Top-right « Connexion » chrome — always on tabs (hidden on /modules/* and carte plein écran).
 * Shares the row under GlobalTopBar overlay with HOS (HOS leaves right clearance).
 */
export function ConnexionChip() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const { t } = useI18n();
  const onModules = pathname?.includes('/modules');
  const onCarte = pathname === '/carte' || pathname?.endsWith('/carte');

  if (onModules || onCarte) return null;

  // Keep label short — full email lives on Compte / Settings.
  const label = profile?.email ? t('connexion.chipSignedIn') : t('connexion.chip');
  const top = belowGlobalTopBar(insets) + CHROME_GAP;

  return (
    <View style={[styles.wrap, { top, right: 10 }]}>
      <Pressable
        style={styles.btn}
        onPress={() => router.push('/modules/compte')}
        accessibilityRole="button"
        accessibilityLabel={
          profile?.email ? t('connexion.openAccountA11y') : t('connexion.openA11y')
        }
        testID="connexion-chip"
      >
        <Text style={styles.txt} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 36,
    width: 112,
  },
  btn: {
    backgroundColor: colors.signal,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: CONNEXION_CHIP_HEIGHT - 4,
  },
  txt: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
