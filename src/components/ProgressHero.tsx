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
  const { visited, streakDays, xp, completionPct, todayBonusClaimed, claimDailyBonus, badges } =
    useProgress();
  const nextBonus = 10 + Math.min(Math.max(streakDays, 1), 14) * 2;

  return (
    <View style={styles.wrap}>
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
    color: '#9BB0C2',
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
  streakLbl: { color: '#FFE8D6', fontSize: 10, fontWeight: '700' },
  track: { height: 8, backgroundColor: '#2A3848', borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.signal, borderRadius: 8 },
  xpRow: { flexDirection: 'row', gap: 8 },
  xpCard: {
    flex: 1,
    backgroundColor: '#243040',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  xpVal: { color: colors.white, fontWeight: '900', fontSize: 15 },
  xpLbl: { color: '#9BB0C2', fontSize: 10, fontWeight: '700', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  meta: { color: '#C5D2DE', fontSize: 12, flex: 1 },
  bonus: { backgroundColor: colors.garage, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  bonusDone: { backgroundColor: '#3A4A3F' },
  bonusTxt: { color: colors.white, fontWeight: '700', fontSize: 11 },
  badgesTitle: { color: '#9BB0C2', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#243040',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#2A3848',
  },
  badgeOn: { borderColor: colors.garage, backgroundColor: '#1E3328' },
  badgeName: { color: '#8A9AAB', fontWeight: '800', fontSize: 11 },
  badgeNameOn: { color: '#B8E0C8' },
  badgeHint: { color: '#6B7785', fontSize: 10, marginTop: 2 },
  badgeHintOn: { color: '#7A9A88' },
});
