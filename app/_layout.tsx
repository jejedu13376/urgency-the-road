import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';
import { ConnexionChip } from '../src/components/ConnexionChip';
import { RegisterGateScreen } from '../src/components/RegisterGateScreen';
import { SafetyDrivingMonitor } from '../src/components/SafetyDrivingMonitor';
import { SosButton } from '../src/components/SosButton';
import { StartupGateScreen } from '../src/components/StartupGateScreen';
import { WeatherBanner } from '../src/components/WeatherBanner';
import { AuthProvider } from '../src/context/AuthContext';
import { FleetProvider } from '../src/context/FleetContext';
import { I18nProvider } from '../src/context/I18nContext';
import { NightModeProvider, useNightMode } from '../src/context/NightModeContext';
import { ProgressProvider } from '../src/context/ProgressContext';
import { RegisterGateProvider, useRegisterGate } from '../src/context/RegisterGateContext';
import { SafetyDrivingProvider } from '../src/context/SafetyDrivingContext';
import { StartupGateProvider, useStartupGate } from '../src/context/StartupGateContext';
import { colors } from '../src/theme/colors';

function AppShell() {
  const { unlocked } = useStartupGate();
  const { ready: registerReady, registered } = useRegisterGate();
  const { active: night } = useNightMode();

  if (!unlocked) {
    return (
      <>
        <StatusBar style="light" />
        <StartupGateScreen />
      </>
    );
  }

  if (!registerReady) {
    return (
      <View style={styles.boot}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.signal} size="large" />
      </View>
    );
  }

  if (!registered) {
    return (
      <>
        <StatusBar style="light" />
        <RegisterGateScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style={night ? 'light' : 'dark'} />
      <WeatherBanner />
      <ConnexionChip />
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
                  <RegisterGateProvider>
                    <FleetProvider>
                      <ProgressProvider>
                        <AppShell />
                      </ProgressProvider>
                    </FleetProvider>
                  </RegisterGateProvider>
                </AuthProvider>
              </StartupGateProvider>
            </NightModeProvider>
          </I18nProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.asphalt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
