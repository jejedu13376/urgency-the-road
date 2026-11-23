import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { colors } from '../../src/theme/colors';

export default function CarteHub() {
  return (
    <Screen title="Carte" subtitle="Modules 7 · 8 · 9">
      <Card title="Navigation & proximité">
        <Link href="/modules/gps" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.title}>M7 — Double GPS (camion / voiture)</Text>
            <Text style={styles.sub}>Transfert Maps / Waze / Apple Plans</Text>
          </Pressable>
        </Link>
        <Link href="/modules/routiers" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.title}>M8 — Routiers (pesage & dépôts PL)</Text>
            <Text style={styles.sub}>Liste mock postes & dépôts</Text>
          </Pressable>
        </Link>
        <Link href="/modules/garages" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.title}>M9 — Garages, dépanneurs & pièces</Text>
            <Text style={styles.sub}>Appel 1 clic · distance mock</Text>
          </Pressable>
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 4,
  },
  title: { fontWeight: '700', color: colors.ink },
  sub: { color: colors.muted, fontSize: 12 },
});
