import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';
import { SafetyDrivingMonitor } from '../src/components/SafetyDrivingMonitor';
import { SosButton } from '../src/components/SosButton';
import { StartupGateScreen } from '../src/components/StartupGateScreen';
import { WeatherBanner } from '../src/components/WeatherBanner';
import { AuthProvider } from '../src/context/AuthContext';
import { FleetProvider } from '../src/context/FleetContext';
import { I18nProvider } from '../src/context/I18nContext';
import { NightModeProvider, useNightMode } from '../src/context/NightModeContext';
import { ProgressProvider } from '../src/context/ProgressContext';
import { SafetyDrivingProvider } from '../src/context/SafetyDrivingContext';
import { StartupGateProvider, useStartupGate } from '../src/context/StartupGateContext';
import { colors } from '../src/theme/colors';

function AppShell() {
  const { unlocked } = useStartupGate();
  const { active: night } = useNightMode();

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
      <StatusBar style={night ? 'light' : 'dark'} />
      <WeatherBanner />
      <SafetyDrivingProvider>
        <SafetyDrivingMonitor />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modules" options={{ headerShown: false, presentation: 'card' }} />
        </Stack>
        <SosButton />
      </SafetyDrivingProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <I18nProvider>
            <NightModeProvider>
              <StartupGateProvider>
                <AuthProvider>
                  <FleetProvider>
                    <ProgressProvider>
                      <AppShell />
                    </ProgressProvider>
                  </FleetProvider>
                </AuthProvider>
              </StartupGateProvider>
            </NightModeProvider>
          </I18nProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
