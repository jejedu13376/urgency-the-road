import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { type as typeScale } from '../theme/type';

/** Interaction / form container — not a decorative hero card. */
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    gap: 10,
  },
  title: {
    ...typeScale.section,
    color: colors.ink,
    marginBottom: 2,
  },
});
