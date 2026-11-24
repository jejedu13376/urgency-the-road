/**
 * Clear, dyslexia-friendly speak / stop control for diagnostics, prices, alerts.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useI18n } from '../../context/I18nContext';
import {
  isAppSpeechMutedSync,
  speakApp,
  stopAppSpeech,
} from '../../services/speech/appSpeech';
import { colors } from '../../theme/colors';

type Props = {
  text: string | null | undefined;
  /** Larger label for important results (diag / prices). */
  labelKey?: 'tts.speak' | 'tts.speakDiag' | 'tts.speakPrice' | 'tts.speakResult' | 'tts.speakAlert';
  style?: StyleProp<ViewStyle>;
  /** When true, speak even if global mute is on (explicit user request). */
  force?: boolean;
  testID?: string;
};

export function SpeakButton({
  text,
  labelKey = 'tts.speak',
  style,
  force = true,
  testID,
}: Props) {
  const { t } = useI18n();
  const [speaking, setSpeaking] = useState(false);
  const phrase = (text ?? '').replace(/\s+/g, ' ').trim();
  const disabled = !phrase;

  useEffect(() => {
    return () => {
      stopAppSpeech();
    };
  }, []);

  const onPress = () => {
    if (speaking) {
      stopAppSpeech();
      setSpeaking(false);
      return;
    }
    if (!phrase) return;
    setSpeaking(true);
    speakApp(phrase, {
      force,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const muted = isAppSpeechMutedSync();
  const a11y = speaking
    ? t('tts.stop')
    : muted && !force
      ? t('tts.mutedHint')
      : t(labelKey);

  return (
    <Pressable
      style={[styles.btn, speaking && styles.btnOn, disabled && styles.btnDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled, busy: speaking }}
      testID={testID}
    >
      <Text style={speaking ? styles.txtOn : styles.txt}>
        {speaking ? t('tts.stop') : t(labelKey)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.signalSoft,
    borderWidth: 2,
    borderColor: colors.signal,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  btnOn: {
    backgroundColor: colors.asphalt,
    borderColor: colors.asphalt,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  txt: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  txtOn: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
