import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { colors } from '../../src/theme/colors';

export default function DiagnosticHub() {
  return (
    <Screen title="Diagnostic" subtitle="Modules 4 · 5 · 6">
      <Card title="Accès rapide">
        <Link href="/modules/diagnostic-ia" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.title}>M4 — Diagnostic IA photo / vidéo / questions</Text>
            <Text style={styles.sub}>Identification pièce, politesse, acoustique (stubs)</Text>
          </Pressable>
        </Link>
        <Link href="/modules/obd" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.title}>M5 — Valise OBD2 & poids lourds</Text>
            <Text style={styles.sub}>DTC mock J1939 / OBD2</Text>
          </Pressable>
        </Link>
        <Link href="/modules/multi-ia" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.title}>M6 — Multi-IA & coach vocal</Text>
            <Text style={styles.sub}>Routeur mock + synthèse vocale locale</Text>
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
