import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export type FormChoiceOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

/**
 * Large opaque choice buttons — dyslexia-friendly (big type, high contrast, solid fills).
 * No glassmorphism / translucency.
 */
export function FormChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 2,
}: {
  label: string;
  options: FormChoiceOption<T>[];
  value: T | null;
  onChange: (next: T) => void;
  columns?: 1 | 2;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const on = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[
                styles.btn,
                columns === 1 && styles.btnFull,
                on && styles.btnOn,
              ]}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={opt.hint ? `${opt.label}. ${opt.hint}` : opt.label}
            >
              <Text style={[styles.btnTxt, on && styles.btnTxtOn]}>{opt.label}</Text>
              {opt.hint ? (
                <Text style={[styles.hint, on && styles.hintOn]}>{opt.hint}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  label: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.2,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  btn: {
    flexGrow: 1,
    flexBasis: '42%',
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.mist,
    borderWidth: 2,
    borderColor: colors.line,
    justifyContent: 'center',
    gap: 2,
  },
  btnFull: { flexBasis: '100%' },
  btnOn: {
    backgroundColor: colors.asphalt,
    borderColor: colors.asphalt,
  },
  btnTxt: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    color: colors.ink,
  },
  btnTxtOn: { color: colors.white },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted, fontWeight: '600' },
  hintOn: { color: colors.mist },
});
