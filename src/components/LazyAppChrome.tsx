import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { View } from 'react-native';

/**
 * Defer non-critical root chrome so the startup/register gate does not
 * evaluate weather / HOS / connexion modules until the shell is unlocked.
 */
const WeatherBanner = lazy(() =>
  import('./WeatherBanner').then((m) => ({ default: m.WeatherBanner })),
);
const ConnexionChip = lazy(() =>
  import('./ConnexionChip').then((m) => ({ default: m.ConnexionChip })),
);
const SafetyDrivingMonitor = lazy(() =>
  import('./SafetyDrivingMonitor').then((m) => ({ default: m.SafetyDrivingMonitor })),
);
const SosButton = lazy(() =>
  import('./SosButton').then((m) => ({ default: m.SosButton })),
);

function ChromeSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<View />}>{children}</Suspense>;
}

export function LazyWeatherBanner() {
  return (
    <ChromeSuspense>
      <WeatherBanner />
    </ChromeSuspense>
  );
}

export function LazyConnexionChip() {
  return (
    <ChromeSuspense>
      <ConnexionChip />
    </ChromeSuspense>
  );
}

export function LazySafetyDrivingMonitor() {
  return (
    <ChromeSuspense>
      <SafetyDrivingMonitor />
    </ChromeSuspense>
  );
}

export function LazySosButton() {
  return (
    <ChromeSuspense>
      <SosButton />
    </ChromeSuspense>
  );
}

/** Type helper for optional future chrome slots. */
export type LazyChromeComponent = ComponentType;
