import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { belowGlobalTopBar, MODULES_HEADER_HEIGHT } from '../../src/chromeInsets';
import { useI18n } from '../../src/context/I18nContext';
import { colors } from '../../src/theme/colors';

/**
 * Modules stack sits fully under GlobalTopBar via wrapper padding.
 * Custom header adds no status-bar inset (avoids iOS/Android/web double-pad).
 */
export default function ModulesLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, paddingTop: belowGlobalTopBar(insets), backgroundColor: colors.white }}>
      <Stack
        screenOptions={{
          header: ({ navigation, options, back }) => (
            <View style={styles.header}>
              <View style={styles.headerRow}>
                {back ? (
                  <Pressable
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel={t('back')}
                    hitSlop={8}
                    style={styles.backBtn}
                  >
                    <Text style={styles.backTxt}>←</Text>
                  </Pressable>
                ) : (
                  <View style={styles.backBtn} />
                )}
                <Text style={styles.title} numberOfLines={1}>
                  {typeof options.title === 'string' ? options.title : ''}
                </Text>
                <View style={styles.backBtn} />
              </View>
            </View>
          ),
          contentStyle: { backgroundColor: colors.paper },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 8,
  },
  headerRow: {
    minHeight: MODULES_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { color: colors.signal, fontSize: 22, fontWeight: '700', lineHeight: 26 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
    color: colors.ink,
  },
});
