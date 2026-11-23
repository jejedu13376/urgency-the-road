import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { LanguagePicker } from '../../src/components/LanguagePicker';
import { ProgressHero } from '../../src/components/ProgressHero';
import { Screen } from '../../src/components/Screen';
import { useI18n } from '../../src/context/I18nContext';
import { useProgress } from '../../src/context/ProgressContext';
import { MODULES } from '../../src/data/modulesMeta';
import { localizedModuleTitle, localizedNavSections } from '../../src/data/localizedNav';
import { colors } from '../../src/theme/colors';
import type { ModuleId } from '../../src/types/modules';

/** Menu — sections claires + parcours vendeur 17 modules (ProgressHero). */
export default function MenuScreen() {
  const { t } = useI18n();
  const { visited, streakDays, xp, completionPct, badges } = useProgress();
  const done = new Set(visited);
  const next = MODULES.find((m) => !done.has(m.id as ModuleId));
  const sections = localizedNavSections(t);
  const nextTitle = next ? localizedModuleTitle(t, next.id).title : '';

  const sellerStrip =
    badges.length > 1
      ? t('menu.sellerStripPlural', {
          days: streakDays,
          xp,
          pct: completionPct,
          badges: badges.length,
        })
      : t('menu.sellerStrip', {
          days: streakDays,
          xp,
          pct: completionPct,
          badges: badges.length,
        });

  return (
    <Screen title={t('appName')} subtitle={t('menu.subtitle')}>
      <LanguagePicker compact />
      <BackendStatusBanner />
      <ProgressHero />

      <View style={styles.sellerStrip}>
        <Text style={styles.sellerTxt}>{sellerStrip}</Text>
        {next ? (
          <Text style={styles.sellerHint}>
            {t('nextStep', { id: next.id, title: nextTitle })}
          </Text>
        ) : (
          <Text style={styles.sellerHint}>{t('parcoursComplete')}</Text>
        )}
      </View>

      <Text style={styles.section}>{t('menu.navSectionsTitle')}</Text>
      {sections.map((sec) => (
        <Card key={sec.id} title={sec.title}>
          <Text style={styles.secSub}>{sec.subtitle}</Text>
          <Link href={sec.href as never} asChild>
            <Pressable style={styles.hubBtn}>
              <Text style={styles.hubTxt}>{t('openSection', { title: sec.title })}</Text>
            </Pressable>
          </Link>
          {sec.links.map((link) => (
            <Link key={link.id} href={link.href as never} asChild>
              <Pressable style={styles.linkRow}>
                {link.moduleTag ? <Text style={styles.id}>{link.moduleTag}</Text> : null}
                <View style={styles.linkBody}>
                  <Text style={styles.linkTitle}>{link.title}</Text>
                  <Text style={styles.linkShort}>{link.short}</Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </Card>
      ))}

      <Text style={styles.section}>{t('continueParcours')}</Text>
      <View style={styles.grid}>
        {MODULES.map((m) => {
          const ok = done.has(m.id as ModuleId);
          const meta = localizedModuleTitle(t, m.id);
          return (
            <Link key={m.id} href={m.href as never} asChild>
              {/* expo-router Slot (Link asChild) throws in __DEV__ if style is an array */}
              <Pressable style={StyleSheet.flatten([styles.tile, ok && styles.tileDone])}>
                <View style={styles.top}>
                  <Text style={styles.id}>M{m.id}</Text>
                  <Text style={styles.check}>{ok ? '✓' : '○'}</Text>
                </View>
                <Text style={styles.title}>{meta.title}</Text>
                <Text style={styles.short}>{meta.short}</Text>
                <Text style={styles.cta}>{ok ? t('see') : t('discover')}</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sellerStrip: {
    backgroundColor: colors.signalSoft,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.signal,
    gap: 4,
  },
  sellerTxt: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  sellerHint: { color: colors.slate, fontSize: 12, fontWeight: '600' },
  section: { fontWeight: '800', color: colors.ink, fontSize: 14, marginTop: 4 },
  secSub: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  hubBtn: {
    backgroundColor: colors.signalSoft,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.signal,
    marginBottom: 4,
  },
  hubTxt: { color: colors.signal, fontWeight: '800', fontSize: 13 },
  linkRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    alignItems: 'flex-start',
  },
  linkBody: { flex: 1, gap: 2 },
  linkTitle: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  linkShort: { color: colors.muted, fontSize: 11 },
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
