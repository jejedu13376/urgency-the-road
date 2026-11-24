import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { applyOtaUpdateIfAvailable } from '../services/ota/checkOtaChannel';
import { colors } from '../theme/colors';

type Props = {
  /** Match GlobalTopBar language squares. */
  square?: boolean;
};

/**
 * Top-right « Mise à jour » — one tap launches OTA/apply immediately.
 * No menu, no confirmation dialog. Feedback stays on the button label only.
 */
export function UpdateButton({ square = false }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const launch = () => {
    if (busy) return;
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    setBusy(true);
    setFlash(null);
    void applyOtaUpdateIfAvailable().then((r) => {
      // reloadAsync leaves this screen on success — if still mounted, flash inline label.
      setBusy(false);
      setFlash(r.ok ? t('update.buttonDone') : t('update.buttonFail'));
      clearTimer.current = setTimeout(() => {
        setFlash(null);
        clearTimer.current = null;
      }, 3500);
    });
  };

  const label = busy ? t('update.buttonBusy') : flash ?? t('update.button');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={busy ? t('update.a11yBusy') : flash ?? t('update.a11y')}
      accessibilityHint={t('update.a11yHint')}
      accessibilityState={{ busy }}
      accessibilityLiveRegion="polite"
      disabled={busy}
      onPress={launch}
      style={({ pressed }) => [
        styles.btn,
        square && styles.btnSquare,
        pressed && !busy && { opacity: 0.88 },
        busy && styles.btnBusy,
      ]}
      testID="update-button"
    >
      <Text
        style={[styles.txt, square && styles.txtSquare]}
        numberOfLines={1}
        allowFontScaling
        maxFontSizeMultiplier={1.35}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.signal,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    maxWidth: 148,
  },
  btnSquare: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 36,
    backgroundColor: colors.signal,
    borderWidth: 1,
    borderColor: colors.signal,
  },
  btnBusy: { opacity: 0.75 },
  txt: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.1,
  },
  txtSquare: { fontSize: 12 },
});
