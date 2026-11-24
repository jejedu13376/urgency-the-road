import { Stack } from 'expo-router';
import { View } from 'react-native';
import { GLOBAL_TOP_BAR_BODY } from '../../src/components/GlobalTopBar';
import { colors } from '../../src/theme/colors';

export default function ModulesLayout() {
  // GlobalTopBar already covers status-bar inset; only clear its body height.
  // Native stack still applies its own top safe-area for the header title.
  return (
    <View style={{ flex: 1, paddingTop: GLOBAL_TOP_BAR_BODY, backgroundColor: colors.white }}>
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
