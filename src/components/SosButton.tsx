import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { colors } from '../theme/colors';

/** Module 13 — bouton SOS toujours accessible → écran Urgence (112 sur l’écran). */
export function SosButton() {
  const pathname = usePathname();

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="SOS Urgence médicale — ouvrir le module Urgence"
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        onPress={() => {
          // Already on Urgence → no-op (avoid stacking a duplicate).
          if (pathname?.includes('/modules/urgence')) return;
          // replace keeps a single Urgence on the stack when navigating from elsewhere.
          router.replace('/modules/urgence');
        }}
      >
        <Text style={styles.txt}>SOS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 14,
    bottom: 92,
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
