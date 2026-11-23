import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useFleet } from '../../src/context/FleetContext';
import { useProgress } from '../../src/context/ProgressContext';
import { colors } from '../../src/theme/colors';

/** Hub diagnostic — Modules 4 · 5 · 6 (+ tunnel vendeur pièces / tutoriels). */
export default function DiagnosticHub() {
  const { active } = useFleet();
  const { xp, completionPct } = useProgress();

  return (
    <Screen
      title="Diagnostic"
      subtitle={`Modules 4 · 5 · 6${active ? ` · ${active.make} ${active.model}` : ''}`}
    >
      <Card title="Parcours vendeur">
        <Text style={styles.meta}>
          Photo / questions / OBD → pièce + prix → tutoriel YouTube → devis. Progression {completionPct}% ·{' '}
          {xp} XP.
        </Text>
        <View style={styles.funnel}>
          {['Diagnostiquer', 'Pièce', 'Réparer', 'Devis'].map((s, i) => (
            <View key={s} style={styles.funnelChip}>
              <Text style={styles.funnelTxt}>
                {i + 1}. {s}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card title="Accès rapide">
        <Link href="/modules/diagnostic-ia" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.id}>M4</Text>
            <View style={styles.body}>
              <Text style={styles.title}>Diagnostic IA photo / vidéo / questions</Text>
              <Text style={styles.sub}>Photo / questions / acoustique — stubs IA ; YouTube live si clé</Text>
            </View>
          </Pressable>
        </Link>
        <Link href="/modules/obd" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.id}>M5</Text>
            <View style={styles.body}>
              <Text style={styles.title}>Valise OBD2 & poids lourds</Text>
              <Text style={styles.sub}>DTC mock J1939 / OBD2 · capteurs temps réel simulés</Text>
            </View>
          </Pressable>
        </Link>
        <Link href="/modules/multi-ia" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.id}>M6</Text>
            <View style={styles.body}>
              <Text style={styles.title}>Multi-IA & coach vocal</Text>
              <Text style={styles.sub}>Routeur mock + synthèse vocale · Stop Voix</Text>
            </View>
          </Pressable>
        </Link>
      </Card>

      <Card title="Enchaînement après diagnostic">
        <Link href="/modules/pieces" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>Catalogue pièces & devis pose (M3) →</Text>
          </Pressable>
        </Link>
        <Link href="/modules/tutoriels" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>Tutoriels YouTube (M11) — pas de vidéo embarquée →</Text>
          </Pressable>
        </Link>
        <Link href="/modules/bases" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>Enrichir la base de pannes (M14) →</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/fil" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>Partager sur le Fil mécanique (M12) →</Text>
          </Pressable>
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12 },
  funnel: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  funnelChip: {
    backgroundColor: colors.signalSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  funnelTxt: { color: colors.signal, fontWeight: '800', fontSize: 11 },
  item: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    alignItems: 'flex-start',
  },
  id: {
    backgroundColor: colors.asphalt,
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  body: { flex: 1, gap: 2 },
  title: { fontWeight: '700', color: colors.ink },
  sub: { color: colors.muted, fontSize: 12 },
  linkRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  linkTxt: { color: colors.signal, fontWeight: '800', fontSize: 13 },
});
