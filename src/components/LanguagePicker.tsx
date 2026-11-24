import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../context/I18nContext';
import type { AppLocale } from '../i18n';
import { colors } from '../theme/colors';

const LABELS: Record<AppLocale, string> = {
  fr: 'FR',
  en: 'EN',
  es: 'ES',
};

const A11Y_KEYS: Record<AppLocale, 'langFr' | 'langEn' | 'langEs'> = {
  fr: 'langFr',
  en: 'langEn',
  es: 'langEs',
};

type Props = {
  /** Show full language names under the section title. */
  showTitle?: boolean;
  compact?: boolean;
  /** Square FR/EN/ES tiles for the global top bar. */
  square?: boolean;
};

/** EN / FR / ES selector — Settings + global top bar. */
export function LanguagePicker({ showTitle = true, compact = false, square = false }: Props) {
  const { locale, setLocale, t, locales } = useI18n();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, square && styles.wrapSquare]}>
      {showTitle ? (
        <>
          <Text style={styles.title}>{t('language')}</Text>
          {!compact ? <Text style={styles.hint}>{t('languageHint')}</Text> : null}
        </>
      ) : null}
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('language')}>
        {locales.map((code) => {
          const on = locale === code;
          return (
            <Pressable
              key={code}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(A11Y_KEYS[code])}
              style={[
                styles.chip,
                on && styles.chipOn,
                compact && styles.chipCompact,
                square && styles.chipSquare,
                square && on && styles.chipSquareOn,
              ]}
              onPress={() => void setLocale(code)}
            >
              <Text
                style={[
                  styles.chipTxt,
                  on && styles.chipTxtOn,
                  square && styles.chipTxtSquare,
                  square && on && styles.chipTxtSquareOn,
                ]}
              >
                {LABELS[code]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  wrapCompact: { marginBottom: 4 },
  wrapSquare: { marginBottom: 0 },
  title: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  chipCompact: { paddingVertical: 8, paddingHorizontal: 12, minWidth: 44 },
  chipSquare: {
    minWidth: 36,
    width: 36,
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 8,
    justifyContent: 'center',
    backgroundColor: '#2A3542',
    borderColor: '#3D4A5A',
  },
  chipSquareOn: {
    backgroundColor: colors.signal,
    borderColor: colors.signal,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { color: colors.slate, fontWeight: '800', fontSize: 13 },
  chipTxtOn: { color: colors.white },
  chipTxtSquare: { color: colors.mist, fontSize: 12, fontWeight: '800' },
  chipTxtSquareOn: { color: colors.white },
});