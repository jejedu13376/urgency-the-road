import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { useProgress } from '../context/ProgressContext';
import { colors } from '../theme/colors';
import { AnimatedBarFill, FadeInBlock, PressScale } from '../theme/motion';

/** Progression vendeuse : barre 17 modules + streak + XP + badges visibles. */
export function ProgressHero() {
  const { t } = useI18n();
  const { ready, visited, streakDays, xp, completionPct, todayBonusClaimed, claimDailyBonus, badges } =
    useProgress();
  const nextBonus = 10 + Math.min(Math.max(streakDays, 1), 14) * 2;

  const badgeMeta = [
    { id: 'premier_pas', label: t('progress.badgePremier'), hint: t('progress.badgePremierHint') },
    {
      id: 'explorateur',
      label: t('progress.badgeExplorateur'),
      hint: t('progress.badgeExplorateurHint'),
    },
    { id: 'mecano_confirme', label: t('progress.badgeMecano'), hint: t('progress.badgeMecanoHint') },
    { id: 'maitre_17', label: t('progress.badgeMaitre'), hint: t('progress.badgeMaitreHint') },
  ];

  if (!ready) {
    return (
      <View style={styles.wrap} accessibilityLabel={t('progress.loadingA11y')}>
        <Text style={styles.kicker}>{t('progress.kicker')}</Text>
        <Text style={styles.title}>{t('loading')}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: '8%' }]} />
        </View>
      </View>
    );
  }

  return (
    <FadeInBlock style={styles.wrap} accessibilityLabel={`Progression ${completionPct} pour cent`}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{t('progress.kicker')}</Text>
          <Text style={styles.title}>{t('progress.pctOf17', { pct: completionPct })}</Text>
        </View>
        <View style={styles.streakBox}>
          <Text style={styles.streakFire}>🔥</Text>
          <Text style={styles.streakVal}>{streakDays}</Text>
          <Text style={styles.streakLbl}>{t('progress.days')}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <AnimatedBarFill pct={completionPct} color={colors.signal} style={styles.fill} />
      </View>

      <View style={styles.xpRow}>
        <View style={styles.xpCard}>
          <Text style={styles.xpVal}>{xp}</Text>
          <Text style={styles.xpLbl}>XP</Text>
        </View>
        <View style={styles.xpCard}>
          <Text style={styles.xpVal}>{visited.length}/17</Text>
          <Text style={styles.xpLbl}>{t('progress.explored')}</Text>
        </View>
        <View style={styles.xpCard}>
          <Text style={styles.xpVal}>+25</Text>
          <Text style={styles.xpLbl}>{t('progress.perModule')}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.meta}>
          {todayBonusClaimed
            ? t('progress.streakMetaClaimed')
            : t('progress.streakMetaNext', { xp: nextBonus })}
        </Text>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={
            todayBonusClaimed
              ? t('progress.bonusClaimedA11y')
              : t('progress.bonusClaimA11y', { xp: nextBonus })
          }
          style={[styles.bonus, todayBonusClaimed && styles.bonusDone]}
          disabled={todayBonusClaimed}
          onPress={() => claimDailyBonus()}
        >
          <Text style={styles.bonusTxt}>
            {todayBonusClaimed
              ? t('progress.bonusClaimed')
              : t('progress.bonusClaim', { xp: nextBonus })}
          </Text>
        </PressScale>
      </View>

      <Text style={styles.badgesTitle}>{t('progress.badgesTitle')}</Text>
      <View style={styles.badgeGrid}>
        {badgeMeta.map((b) => {
          const unlocked = badges.includes(b.id);
          return (
            <View key={b.id} style={[styles.badge, unlocked && styles.badgeOn]}>
              <Text style={[styles.badgeName, unlocked && styles.badgeNameOn]}>
                {unlocked ? '✓ ' : '○ '}
                {b.label}
              </Text>
              <Text style={[styles.badgeHint, unlocked && styles.badgeHintOn]}>{b.hint}</Text>
            </View>
          );
        })}
      </View>
    </FadeInBlock>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.asphalt,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  kicker: {
    color: colors.mist,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: { color: colors.white, fontSize: 20, fontWeight: '900', marginTop: 2, lineHeight: 26 },
  streakBox: {
    backgroundColor: colors.signal,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 68,
  },
  streakFire: { fontSize: 14 },
  streakVal: { color: colors.white, fontWeight: '900', fontSize: 20, lineHeight: 22 },
  streakLbl: { color: colors.signalSoft, fontSize: 11, fontWeight: '700' },
  track: { height: 10, backgroundColor: colors.slate, borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 8 },
  xpRow: { flexDirection: 'row', gap: 8 },
  xpCard: {
    flex: 1,
    backgroundColor: colors.slate,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  xpVal: { color: colors.white, fontWeight: '900', fontSize: 16 },
  xpLbl: { color: colors.mist, fontSize: 11, fontWeight: '700', marginTop: 2 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    color: colors.mist,
    fontSize: 13,
    lineHeight: 18,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
    fontWeight: '600',
  },
  bonus: {
    backgroundColor: colors.garage,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  bonusDone: { backgroundColor: colors.slate },
  bonusTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
  badgesTitle: {
    color: colors.mist,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.slate,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.asphalt,
  },
  badgeOn: { borderColor: colors.garage, backgroundColor: colors.garage },
  badgeName: { color: colors.muted, fontWeight: '800', fontSize: 12, lineHeight: 16 },
  badgeNameOn: { color: colors.white },
  badgeHint: { color: colors.muted, fontSize: 11, marginTop: 2, lineHeight: 15 },
  badgeHintOn: { color: colors.garageSoft },
});
