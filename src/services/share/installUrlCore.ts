/**
 * Pure install-URL picker (no React Native) — unit-testable.
 * Never invents a store listing URL.
 */

export type InstallUrlInfo = {
  url: string;
  configured: boolean;
  source: 'env' | 'linking' | 'expo' | 'unset';
};

export const UNSET_INSTALL_PLACEHOLDER =
  '(lien d’installation non configuré — définissez EXPO_PUBLIC_INSTALL_URL)';

export type InstallUrlInputs = {
  envUrl?: string | null;
  extraUrl?: string | null;
  linkingUri?: string | null;
  /** From expo-linking createURL — only accepted if http(s) */
  expoUrl?: string | null;
};

function httpish(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

export function pickInstallUrl(input: InstallUrlInputs): InstallUrlInfo {
  const fromEnv = (input.envUrl ?? '').trim();
  if (fromEnv) return { url: fromEnv, configured: true, source: 'env' };

  const extra = (input.extraUrl ?? '').trim();
  if (extra) return { url: extra, configured: true, source: 'linking' };

  const linking = (input.linkingUri ?? '').trim();
  if (linking && httpish(linking)) {
    return { url: linking, configured: true, source: 'linking' };
  }

  const expo = (input.expoUrl ?? '').trim();
  if (expo && httpish(expo)) {
    return { url: expo, configured: true, source: 'expo' };
  }

  return {
    url: UNSET_INSTALL_PLACEHOLDER,
    configured: false,
    source: 'unset',
  };
}
