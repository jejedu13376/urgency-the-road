import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { belowGlobalTopBar } from '../../src/chromeInsets';
import { colors } from '../../src/theme/colors';

export default function ModulesLayout() {
  const insets = useSafeAreaInsets();
  // Full clear of GlobalTopBar overlay (status inset + body). Once the stack sits below
  // the notch, native header topInset collapses to ~0 so we do not double-pad.
  return (
    <View style={{ flex: 1, paddingTop: belowGlobalTopBar(insets), backgroundColor: colors.white }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.signal,
          headerTitleStyle: { fontWeight: '800', color: colors.ink },
          contentStyle: { backgroundColor: colors.paper },
        }}
      />
    </View>
  );
}
