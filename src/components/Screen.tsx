import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

/**
 * Room below status bar for GlobalTopBar overlay + Connexion + weather chrome stack.
 * Keep in sync with GlobalTopBar / ConnexionChip / WeatherBanner offsets.
 */
const CHROME_BELOW_INSET = 132;
/** SOS FAB sits at bottom ~92 with height 58 — clear last CTAs. */
const SOS_FAB_CLEARANCE = 166;

export function Screen({
  title,
  subtitle,
  children,
  scroll = true,
  refreshing,
  onRefresh,
  variant = 'tabs',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * `tabs` — full chrome inset for WeatherBanner above custom header.
   * `stack` — nested under modules Stack header (no double title, no chrome inset).
   */
  variant?: 'tabs' | 'stack';
}) {
  const insets = useSafeAreaInsets();
  const isStack = variant === 'stack';
  const headerPadTop = isStack ? 8 : insets.top + CHROME_BELOW_INSET;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.signal} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {isStack ? (
        subtitle ? (
          <View style={styles.stackSubWrap}>
            <Text style={styles.sub}>{subtitle}</Text>
          </View>
        ) : null
      ) : (
        <View style={[styles.header, { paddingTop: headerPadTop }]}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
      )}
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
  },
  stackSubWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  sub: {
    marginTop: 4,
    color: colors.slate,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  content: { padding: 16, paddingBottom: SOS_FAB_CLEARANCE, gap: 14 },
});
