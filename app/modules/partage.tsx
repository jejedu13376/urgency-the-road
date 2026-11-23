import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { colors } from '../../src/theme/colors';

const INSTALL =
  'Installe Urgence Mécanique (urgency road one) — diagnostic & flotte : https://expo.dev (lien install stub). FR · CA · EU · AU';

/** Module 16 — partage viral & install universelle. */
export default function PartageScreen() {
  useModuleVisit(16);

  const share = (channel: string) =>
    void Share.share({
      message: `${INSTALL}\nVia ${channel}`,
      title: 'Urgence Mécanique',
    });

  return (
    <>
      <Stack.Screen options={{ title: 'Partage' }} />
      <Screen title="Partage viral" subtitle="Module 16 — installation universelle">
        <Card title="Envoyer en 1 clic">
          <View style={styles.grid}>
            {['SMS/Texto', 'WhatsApp', 'Email', 'Réseaux'].map((c) => (
              <Pressable key={c} style={styles.btn} onPress={() => share(c)}>
                <Text style={styles.btnTxt}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
        <Card title="Multi-support">
          <Text style={styles.line}>Android · iOS (Expo) · Web/Desktop (à brancher PWA)</Text>
          <Text style={styles.meta}>Plateforme actuelle : {Platform.OS}</Text>
          <Text style={styles.meta}>Ajout écran d’accueil : via navigateur / Expo Go (flow natif OS).</Text>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: '46%',
    alignItems: 'center',
  },
  btnTxt: { color: colors.white, fontWeight: '800' },
  line: { color: colors.ink, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12 },
});
