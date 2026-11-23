import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { ProgressHero } from '../../src/components/ProgressHero';
import { Screen } from '../../src/components/Screen';
import { useProgress } from '../../src/context/ProgressContext';
import { MODULES } from '../../src/data/modulesMeta';
import { fr } from '../../src/i18n/fr';
import { colors } from '../../src/theme/colors';
import type { ModuleId } from '../../src/types/modules';

export default function MenuScreen() {
  const { visited } = useProgress();
  const done = new Set(visited);

  return (
    <Screen title={fr.appName} subtitle="Parcours vendeur — 17 modules">
      <BackendStatusBanner />
      <ProgressHero />
      <Text style={styles.section}>Continuer le parcours</Text>
      <View style={styles.grid}>
        {MODULES.map((m) => {
          const ok = done.has(m.id as ModuleId);
          return (
            <Link key={m.id} href={m.href as never} asChild>
              <Pressable style={[styles.tile, ok && styles.tileDone]}>
                <View style={styles.top}>
                  <Text style={styles.id}>M{m.id}</Text>
                  <Text style={styles.check}>{ok ? '✓' : '○'}</Text>
                </View>
                <Text style={styles.title}>{m.title}</Text>
                <Text style={styles.short}>{m.short}</Text>
                <Text style={styles.cta}>{ok ? 'Revoir' : 'Découvrir · +25 XP'}</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: '800', color: colors.ink, fontSize: 14, marginTop: 4 },
  grid: { gap: 10 },
  tile: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tileDone: { borderColor: colors.garage, backgroundColor: '#F3FAF6' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  id: {
    backgroundColor: colors.asphalt,
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  check: { fontSize: 16, fontWeight: '900', color: colors.garage },
  title: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  short: { color: colors.muted, fontSize: 12, marginTop: 2 },
  cta: { marginTop: 8, color: colors.signal, fontWeight: '800', fontSize: 12 },
});
