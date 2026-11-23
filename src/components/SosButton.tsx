import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

/** Module 13 — bouton SOS toujours accessible. */
export function SosButton() {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="SOS Urgence médicale"
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        onPress={() => {
          // FR défaut — numéro d'urgence européen; pas de géolocalisation live forcée ici
          void Linking.openURL('tel:112');
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
