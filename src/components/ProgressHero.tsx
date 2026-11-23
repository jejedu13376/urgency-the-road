import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useProgress } from '../context/ProgressContext';
import { colors } from '../theme/colors';

const BADGE_META: { id: string; label: string; hint: string }[] = [
  { id: 'premier_pas', label: 'Premier pas', hint: '1 module' },
  { id: 'explorateur', label: 'Explorateur', hint: '5 modules' },
  { id: 'mecano_confirme', label: 'Mécano confirmé', hint: '10 modules' },
  { id: 'maitre_17', label: 'Maître des 17', hint: '17/17' },
];

/** Progression vendeuse : barre 17 modules + streak + XP + badges visibles. */
export function ProgressHero() {
  const { ready, visited, streakDays, xp, completionPct, todayBonusClaimed, claimDailyBonus, badges } =
    useProgress();
  const nextBonus = 10 + Math.min(Math.max(streakDays, 1), 14) * 2;

  if (!ready) {
    return (
      <View style={styles.wrap} accessibilityLabel="Chargement progression">
        <Text style={styles.kicker}>Parcours vendeur Urgence Mécanique</Text>
        <Text style={styles.title}>Chargement…</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: '8%' }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityLabel={`Progression ${completionPct} pour cent`}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Parcours vendeur Urgence Mécanique</Text>
          <Text style={styles.title}>{completionPct}% des 17 modules</Text>
        </View>
        <View style={styles.streakBox}>
          <Text style={styles.streakFire}>🔥</Text>
          <Text style={styles.streakVal}>{streakDays}</Text>
          <Text style={styles.streakLbl}>jours</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(4, completionPct)}%` }]} />
      </View>

      <View style={styles.xpRow}>
        <View style={styles.xpCard}>
          <Text style={styles.xpVal}>{xp}</Text>
          <Text style={styles.xpLbl}>XP</Text>
        </View>
        <View style={styles.xpCard}>
          <Text style={styles.xpVal}>{visited.length}/17</Text>
          <Text style={styles.xpLbl}>explorés</Text>
        </View>
        <View style={styles.xpCard}>
          <Text style={styles.xpVal}>+25</Text>
          <Text style={styles.xpLbl}>/ module</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.meta}>
          Streak actif · bonus jour {todayBonusClaimed ? 'réclamé' : `+${nextBonus} XP`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            todayBonusClaimed ? 'Bonus du jour déjà réclamé' : `Récupérer bonus plus ${nextBonus} XP`
          }
          style={[styles.bonus, todayBonusClaimed && styles.bonusDone]}
          disabled={todayBonusClaimed}
          onPress={() => claimDailyBonus()}
        >
          <Text style={styles.bonusTxt}>
            {todayBonusClaimed ? 'Bonus du jour ✓' : `Récupérer +${nextBonus} XP`}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.badgesTitle}>Badges vendeur</Text>
      <View style={styles.badgeGrid}>
        {BADGE_META.map((b) => {
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.asphalt,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  kicker: {
    color: colors.mist,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.white, fontSize: 18, fontWeight: '800', marginTop: 2 },
  streakBox: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 64,
  },
  streakFire: { fontSize: 14 },
  streakVal: { color: colors.white, fontWeight: '900', fontSize: 18, lineHeight: 20 },
  streakLbl: { color: colors.signalSoft, fontSize: 10, fontWeight: '700' },
  track: { height: 8, backgroundColor: colors.slate, borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.signal, borderRadius: 8 },
  xpRow: { flexDirection: 'row', gap: 8 },
  xpCard: {
    flex: 1,
    backgroundColor: colors.slate,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  xpVal: { color: colors.white, fontWeight: '900', fontSize: 15 },
  xpLbl: { color: colors.mist, fontSize: 10, fontWeight: '700', marginTop: 2 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  meta: { color: colors.mist, fontSize: 12, flexGrow: 1, flexShrink: 1, minWidth: 120 },
  bonus: { backgroundColor: colors.garage, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  bonusDone: { backgroundColor: colors.slate },
  bonusTxt: { color: colors.white, fontWeight: '700', fontSize: 11 },
  badgesTitle: { color: colors.mist, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.slate,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.asphalt,
  },
  badgeOn: { borderColor: colors.garage, backgroundColor: colors.garage },
  badgeName: { color: colors.muted, fontWeight: '800', fontSize: 11 },
  badgeNameOn: { color: colors.white },
  badgeHint: { color: colors.muted, fontSize: 10, marginTop: 2 },
  badgeHintOn: { color: colors.garageSoft },
});
