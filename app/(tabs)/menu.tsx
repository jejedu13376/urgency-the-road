import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { ProgressHero } from '../../src/components/ProgressHero';
import { Screen } from '../../src/components/Screen';
import { UpdateButton } from '../../src/components/UpdateButton';
import { BRAND_NAME } from '../../src/brand';
import { useI18n } from '../../src/context/I18nContext';
import { useProgress } from '../../src/context/ProgressContext';
import { MODULES } from '../../src/data/modulesMeta';
import { localizedModuleTitle, localizedNavSections } from '../../src/data/localizedNav';
import { colors } from '../../src/theme/colors';
import type { ModuleId } from '../../src/types/modules';

const GRID_GAP = 10;
const GRID_PAD = 0; // Screen already pads content
const COLS = 2;

/** Menu — sections claires + grille modules opaque (pas de glassmorphism). */
export default function MenuScreen() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const { visited, streakDays, xp, completionPct, badges } = useProgress();
  const done = new Set(visited);
  const next = MODULES.find((m) => !done.has(m.id as ModuleId));
  const sections = localizedNavSections(t);
  const nextTitle = next ? localizedModuleTitle(t, next.id).title : '';

  // Fill horizontal space with equal square tiles (Screen content padding = 16×2).
  const contentWidth = Math.max(280, width - 32);
  const tileSize = Math.floor((contentWidth - GRID_GAP * (COLS - 1) - GRID_PAD) / COLS);

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
    <Screen title={BRAND_NAME} subtitle={t('menu.subtitle')}>
      {/* Four-dot tab hub = updates (not SOS). Same one-tap launch as top-right chrome. */}
      <View style={styles.updateRow}>
        <Text style={styles.updateHint} allowFontScaling maxFontSizeMultiplier={1.35}>
          {t('update.hubHint')}
        </Text>
        <UpdateButton />
      </View>
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

      <View style={styles.modulesHeader}>
        <Text style={styles.section}>{t('menu.modulesTitle')}</Text>
        <Text style={styles.modulesSub}>{t('menu.modulesSubtitle')}</Text>
      </View>
      <View style={[styles.grid, { gap: GRID_GAP }]}>
        {MODULES.map((m) => {
          const ok = done.has(m.id as ModuleId);
          const meta = localizedModuleTitle(t, m.id);
          return (
            <Link key={m.id} href={m.href as never} asChild>
              {/* expo-router Slot (Link asChild) throws in __DEV__ if style is an array */}
              <Pressable
                style={StyleSheet.flatten([
                  styles.tile,
                  ok && styles.tileDone,
                  { width: tileSize, height: tileSize },
                ])}
                accessibilityRole="button"
                accessibilityLabel={`M${m.id} ${meta.title}`}
              >
                <View style={styles.top}>
                  <Text style={styles.id}>M{m.id}</Text>
                  <Text style={[styles.check, ok && styles.checkDone]}>{ok ? '✓' : '○'}</Text>
                </View>
                <View style={styles.tileBody}>
                  <Text style={styles.title} numberOfLines={3}>
                    {meta.title}
                  </Text>
                  <Text style={styles.short} numberOfLines={2}>
                    {meta.short}
                  </Text>
                </View>
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
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.signalSoft,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.signal,
  },
  updateHint: {
    flex: 1,
    color: colors.ink,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
  },
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
  section: { fontWeight: '800', color: colors.ink, fontSize: 16, marginTop: 4 },
  modulesHeader: { gap: 2, marginTop: 4 },
  modulesSub: { color: colors.muted, fontSize: 13, fontWeight: '600' },
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    justifyContent: 'space-between',
  },
  tileDone: {
    borderColor: colors.garage,
    backgroundColor: colors.garageSoft,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  id: {
    backgroundColor: colors.asphalt,
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  check: { fontSize: 18, fontWeight: '900', color: colors.muted },
  checkDone: { color: colors.garage },
  tileBody: { flex: 1, justifyContent: 'center', gap: 4, paddingVertical: 4 },
  title: { fontWeight: '800', color: colors.ink, fontSize: 14, lineHeight: 18 },
  short: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  cta: { color: colors.signal, fontWeight: '800', fontSize: 12 },
});
