import { Stack } from 'expo-router';
import { colors } from '../../src/theme/colors';

export default function ModulesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.signal,
        headerTitleStyle: { fontWeight: '800', color: colors.ink },
        contentStyle: { backgroundColor: colors.paper },
      }}
    />
  );
}
