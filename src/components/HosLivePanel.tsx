/**
 * Live personal HOS: legal hours left today + next mandatory stop, per CA/US/EU/AU.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HosLiveStatus } from '../services/urgence/hosLive';
import type { HosRegionId } from '../services/urgence/hosRegs';
import { colors } from '../theme/colors';

const REGIONS: HosRegionId[] = ['CA', 'US', 'EU', 'AU'];

type Props = {
  hosLive: HosLiveStatus;
  selected: HosRegionId;
  onSelectRegion: (id: HosRegionId) => void;
  compact?: boolean;
};

export function HosLivePanel({ hosLive, selected, onSelectRegion, compact }: Props) {
  const tone = hosLive.compliance.overLimit
    ? styles.over
    : hosLive.compliance.nearLimit
      ? styles.warn
      : styles.ok;

  return (
    <View style={[styles.wrap, tone, compact && styles.compact]}>
      <Text style={styles.title}>HOS live · {selected}</Text>
      <View style={styles.row}>
        {REGIONS.map((id) => (
          <Pressable
            key={id}
            style={[styles.chip, selected === id && styles.chipOn]}
            onPress={() => onSelectRegion(id)}
            accessibilityLabel={`HOS region ${id}`}
          >
            <Text style={[styles.chipTxt, selected === id && styles.chipTxtOn]}>{id}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.big}>Heures légales restantes : {hosLive.hoursLeftLabel}</Text>
      <Text style={styles.stop}>Prochain arrêt obligatoire : {hosLive.nextMandatoryStopLabel}</Text>
      {!compact ? (
        <>
          <Text style={styles.meta}>{hosLive.regionLabel}</Text>
          {hosLive.compliance.warnReasons.length > 0 ? (
            <Text style={styles.warnTxt}>⚠ {hosLive.compliance.warnReasons.join(' · ')}</Text>
          ) : null}
          {hosLive.compliance.overReasons.length > 0 ? (
            <Text style={styles.overTxt}>⛔ {hosLive.compliance.overReasons.join(' · ')}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.mist,
  },
  compact: { paddingVertical: 8 },
  ok: { borderColor: colors.garage },
  warn: { borderColor: colors.warn, backgroundColor: colors.warnSoft },
  over: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  title: { fontWeight: '900', color: colors.ink, fontSize: 13 },
  row: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { fontWeight: '800', fontSize: 12, color: colors.ink },
  chipTxtOn: { color: colors.white },
  big: { fontWeight: '900', fontSize: 16, color: colors.ink },
  stop: { fontWeight: '700', fontSize: 13, color: colors.slate, lineHeight: 18 },
  meta: { fontSize: 11, color: colors.muted },
  warnTxt: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  overTxt: { color: colors.danger, fontWeight: '800', fontSize: 12 },
});
