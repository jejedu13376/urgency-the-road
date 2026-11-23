import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useProgress } from '../context/ProgressContext';
import { colors } from '../theme/colors';

/** Progression vendeuse : barre 17 modules + streak quotidien. */
export function ProgressHero() {
  const { visited, streakDays, xp, completionPct, todayBonusClaimed, claimDailyBonus, badges } = useProgress();
  const bonus = claimDailyBonus;

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View>
          <Text style={styles.kicker}>Parcours Urgence Mécanique</Text>
          <Text style={styles.title}>{completionPct}% des 17 modules</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillTxt}>🔥 {streakDays} j</Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(4, completionPct)}%` }]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.meta}>
          {visited.length}/17 explorés · {xp} XP
        </Text>
        <Pressable
          style={[styles.bonus, todayBonusClaimed && styles.bonusDone]}
          disabled={todayBonusClaimed}
          onPress={() => bonus()}
        >
          <Text style={styles.bonusTxt}>{todayBonusClaimed ? 'Bonus du jour ✓' : 'Récupérer bonus XP'}</Text>
        </Pressable>
      </View>
      {badges.length > 0 ? (
        <Text style={styles.badges}>Badges : {badges.map(badgeLabel).join(' · ')}</Text>
      ) : (
        <Text style={styles.badges}>Ouvre un module pour gagner ton premier badge.</Text>
      )}
    </View>
  );
}

function badgeLabel(id: string) {
  const map: Record<string, string> = {
    premier_pas: 'Premier pas',
    explorateur: 'Explorateur',
    mecano_confirme: 'Mécano confirmé',
    maitre_17: 'Maître des 17',
  };
  return map[id] ?? id;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.asphalt,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: '#9BB0C2', fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 18, fontWeight: '800', marginTop: 2 },
  pill: { backgroundColor: colors.signal, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillTxt: { color: colors.white, fontWeight: '800', fontSize: 12 },
  track: { height: 8, backgroundColor: '#2A3848', borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.signal, borderRadius: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  meta: { color: '#C5D2DE', fontSize: 12, flex: 1 },
  bonus: { backgroundColor: colors.garage, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  bonusDone: { backgroundColor: '#3A4A3F' },
  bonusTxt: { color: colors.white, fontWeight: '700', fontSize: 11 },
  badges: { color: '#A8B8C7', fontSize: 11 },
});
