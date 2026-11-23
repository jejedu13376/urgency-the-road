import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SosButton } from '../src/components/SosButton';
import { StartupGateScreen } from '../src/components/StartupGateScreen';
import { WeatherBanner } from '../src/components/WeatherBanner';
import { AuthProvider } from '../src/context/AuthContext';
import { FleetProvider } from '../src/context/FleetContext';
import { ProgressProvider } from '../src/context/ProgressContext';
import { StartupGateProvider, useStartupGate } from '../src/context/StartupGateContext';
import { colors } from '../src/theme/colors';

function AppShell() {
  const { unlocked } = useStartupGate();

  if (!unlocked) {
    return (
      <>
        <StatusBar style="light" />
        <StartupGateScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <WeatherBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modules" options={{ headerShown: false, presentation: 'card' }} />
      </Stack>
      <SosButton />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <SafeAreaProvider>
        <StartupGateProvider>
          <AuthProvider>
            <FleetProvider>
              <ProgressProvider>
                <AppShell />
              </ProgressProvider>
            </FleetProvider>
          </AuthProvider>
        </StartupGateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
