/**
 * IMMEDIATE prominent route alert overlay — interrupts nav UI.
 * Not a passive list: full-bleed card until dismissed / acknowledged.
 */
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { useI18n } from '../../context/I18nContext';
import type { RouteAlert } from '../../services/gps/truckerRouteAdvisories';
import { speakNav } from '../../services/gps/navSpeech';
import { colors } from '../../theme/colors';
import { SpeakButton } from '../speech/SpeakButton';

type Props = {
  alert: RouteAlert | null;
  voiceEnabled: boolean;
  onDismiss: () => void;
  onMuteVoice?: () => void;
};

export function GpsRouteAlertOverlay({ alert, voiceEnabled, onDismiss, onMuteVoice }: Props) {
  const { t } = useI18n();

  useEffect(() => {
    if (!alert) return;
    if (voiceEnabled && alert.voice) {
      speakNav(alert.voice, { force: false });
    }
  }, [alert?.id, voiceEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!alert) return null;

  const tone =
    alert.severity === 'critical'
      ? styles.cardCritical
      : alert.severity === 'warn'
        ? styles.cardWarn
        : styles.cardInfo;

  const speakText = [alert.title, alert.detail].filter(Boolean).join('. ');

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View
          style={[styles.card, tone]}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          accessibilityLabel={`${alert.title}. ${alert.detail}`}
        >
          <Text style={styles.badge}>
            {alert.severity === 'critical'
              ? 'ALERTE'
              : alert.severity === 'warn'
                ? 'ATTENTION'
                : 'INFO TRAJET'}
          </Text>
          <Text style={styles.title}>{alert.title}</Text>
          <Text style={styles.detail}>{alert.detail}</Text>
          {alert.distanceKm != null ? (
            <Text style={styles.meta}>≈ {alert.distanceKm} km</Text>
          ) : null}
          <SpeakButton
            text={speakText}
            labelKey="tts.speakAlert"
            style={styles.speakBtn}
            testID="gps-alert-speak"
          />
          <View style={styles.actions}>
            {voiceEnabled && onMuteVoice ? (
              <Pressable
                style={styles.ghost}
                onPress={onMuteVoice}
                accessibilityRole="button"
                accessibilityLabel={t('tts.muteA11y')}
              >
                <Text style={styles.ghostTxt}>{t('tts.mute')}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.ack} onPress={onDismiss} accessibilityRole="button">
              <Text style={styles.ackTxt}>OK — reprendre</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,12,18,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 2,
  },
  cardCritical: {
    backgroundColor: '#2A1212',
    borderColor: '#E74C3C',
  },
  cardWarn: {
    backgroundColor: '#2A1C10',
    borderColor: '#E67E22',
  },
  cardInfo: {
    backgroundColor: '#121820',
    borderColor: '#3B5BDB',
  },
  badge: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
    opacity: 0.9,
  },
  title: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 22,
    lineHeight: 26,
    marginBottom: 10,
  },
  detail: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  meta: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    fontSize: 12,
  },
  speakBtn: {
    marginTop: 14,
    alignSelf: 'stretch',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  ghost: {
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
  },
  ghostTxt: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 13 },
  ack: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ackTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
