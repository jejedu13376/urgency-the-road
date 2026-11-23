import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { colors } from '../theme/colors';

/**
 * Top-right « Connexion » chrome — always on tabs (hidden on /modules/* and carte plein écran).
 * Opens Compte (M15) for sign-in / sign-up.
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

  const label = profile?.email
    ? profile.email.length > 18
      ? `${profile.email.slice(0, 16)}…`
      : profile.email
    : t('connexion.chip');

  return (
    <View style={[styles.wrap, { top: Math.max(insets.top, 8), right: 10 }]}>
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
    zIndex: 25,
    maxWidth: '42%',
  },
  btn: {
    backgroundColor: colors.signal,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  txt: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
