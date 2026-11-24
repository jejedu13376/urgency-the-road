/**
 * Root-level safety HUD: HOS live, driving hours, truck speed, fatigue stop.
 * GPS watch is motion-based (not app-open wall clock).
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { belowGlobalTopBar, CHROME_GAP, CONNEXION_RIGHT_CLEARANCE } from '../chromeInsets';
import { HosLivePanel } from './HosLivePanel';
import { useSafetyDriving } from '../context/SafetyDrivingContext';
import { DRIVING_BREAK_THRESHOLD_SEC } from '../services/urgence/drivingBreak';
import { colors } from '../theme/colors';

function formatHms(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h} h ${String(m).padStart(2, '0')} min ${String(sec).padStart(2, '0')} s`;
}

export function SafetyDrivingMonitor() {
  const insets = useSafeAreaInsets();
  const {
    breakState,
    fatigue,
    speedLimit,
    speedKmh,
    overspeed,
    monitoring,
    setMonitoring,
    takeBreak,
    hosLive,
    hosRegion,
    setHosRegion,
  } = useSafetyDriving();

  const showHardStop = fatigue.mustStop || hosLive.compliance.overLimit;
  const showBreak = breakState.drivingSec >= DRIVING_BREAK_THRESHOLD_SEC;

  return (
    <>
      <View
        style={[
          styles.chip,
          {
            // Under GlobalTopBar overlay; leave right clearance so Connexion stays tappable.
            top: belowGlobalTopBar(insets) + CHROME_GAP,
            right: CONNEXION_RIGHT_CLEARANCE,
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          style={[styles.chipBtn, monitoring ? styles.chipOn : styles.chipOff]}
          onPress={() => setMonitoring((v) => !v)}
          accessibilityLabel="Safety driving monitor"
        >
          <Text style={[styles.chipTxt, !monitoring && styles.chipTxtOff]} numberOfLines={2}>
            {monitoring ? 'HOS ON' : 'HOS OFF'} · {hosRegion} · reste {hosLive.hoursLeftLabel}
            {speedKmh != null ? ` · ${Math.round(speedKmh)}/${speedLimit.limitKmh}` : ''}
            {overspeed ? ' · VITESSE' : ''}
            {fatigue.level !== 'ok' ? ` · fatigue ${fatigue.score}` : ''}
          </Text>
        </Pressable>
      </View>

      <Modal visible={showHardStop || showBreak} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {showHardStop ? 'ARRÊT OBLIGATOIRE' : 'PAUSE CONDUITE'}
            </Text>
            <HosLivePanel
              hosLive={hosLive}
              selected={hosRegion}
              onSelectRegion={(id) => {
                void setHosRegion(id);
              }}
            />
            <Text style={styles.modalBody}>
              Chrono mouvement : {formatHms(breakState.drivingSec)} · fatigue {fatigue.score}/100
            </Text>
            <Pressable
              style={styles.breakBtn}
              onPress={() => {
                void takeBreak();
              }}
            >
              <Text style={styles.breakTxt}>Je fais une pause — reset HOS / chrono</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    left: 8,
    zIndex: 35,
    elevation: 35,
  },
  chipBtn: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipOff: { backgroundColor: colors.mist, borderColor: colors.line },
  chipTxt: { color: colors.white, fontWeight: '800', fontSize: 11 },
  chipTxtOff: { color: colors.ink },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.paper,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  modalTitle: { fontWeight: '900', fontSize: 18, color: colors.danger },
  modalBody: { color: colors.slate, fontWeight: '600', fontSize: 13 },
  breakBtn: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  breakTxt: { color: colors.white, fontWeight: '900' },
});
