import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useFleet } from '../../src/context/FleetContext';
import { useI18n } from '../../src/context/I18nContext';
import { useProgress } from '../../src/context/ProgressContext';
import { colors } from '../../src/theme/colors';

/** Hub diagnostic — Modules 4 · 5 · 6 (+ tunnel vendeur pièces / tutoriels). */
export default function DiagnosticHub() {
  const { active } = useFleet();
  const { xp, completionPct } = useProgress();
  const { t } = useI18n();
  const steps = [
    t('diagnostic.stepDiagnose'),
    t('diagnostic.stepPart'),
    t('diagnostic.stepRepair'),
    t('diagnostic.stepQuote'),
  ];

  return (
    <Screen
      title={t('diagnostic.title')}
      subtitle={`${t('diagnostic.subtitle')}${active ? ` · ${active.make} ${active.model}` : ''}`}
    >
      <Card title={t('diagnostic.parcours')}>
        <Text style={styles.meta}>
          {t('diagnostic.parcoursMeta', { pct: completionPct, xp })}
        </Text>
        <View style={styles.funnel}>
          {steps.map((s, i) => (
            <View key={s} style={styles.funnelChip}>
              <Text style={styles.funnelTxt}>
                {i + 1}. {s}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card title={t('diagnostic.quickAccess')}>
        <Link href="/modules/diagnostic-ia" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.id}>M4</Text>
            <View style={styles.body}>
              <Text style={styles.title}>{t('diagnostic.m4Title')}</Text>
              <Text style={styles.sub}>{t('diagnostic.m4Sub')}</Text>
            </View>
          </Pressable>
        </Link>
        <Link href="/modules/obd" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.id}>M5</Text>
            <View style={styles.body}>
              <Text style={styles.title}>{t('diagnostic.m5Title')}</Text>
              <Text style={styles.sub}>{t('diagnostic.m5Sub')}</Text>
            </View>
          </Pressable>
        </Link>
        <Link href="/modules/multi-ia" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.id}>M6</Text>
            <View style={styles.body}>
              <Text style={styles.title}>{t('diagnostic.m6Title')}</Text>
              <Text style={styles.sub}>{t('diagnostic.m6Sub')}</Text>
            </View>
          </Pressable>
        </Link>
      </Card>

      <Card title={t('diagnostic.after')}>
        <Link href="/modules/pieces" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>{t('diagnostic.linkPieces')}</Text>
          </Pressable>
        </Link>
        <Link href="/modules/tutoriels" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>{t('diagnostic.linkTutoriels')}</Text>
          </Pressable>
        </Link>
        <Link href="/modules/bases" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>{t('diagnostic.linkBases')}</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/fil" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>{t('diagnostic.linkFil')}</Text>
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
