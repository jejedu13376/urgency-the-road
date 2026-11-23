import { StyleSheet, Text, View } from 'react-native';
import { firebaseStatusLabel, isFirebaseConfigured } from '../firebase/config';
import { colors } from '../theme/colors';

export function BackendStatusBanner() {
  const live = isFirebaseConfigured();
  return (
    <View style={[styles.wrap, live ? styles.live : styles.mock]}>
      <Text style={styles.txt}>{firebaseStatusLabel()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  live: { backgroundColor: colors.garageSoft, borderWidth: 1, borderColor: colors.garage },
  mock: { backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: colors.warn },
  txt: { fontSize: 11, fontWeight: '700', color: colors.ink },
});
