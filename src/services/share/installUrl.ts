/**
 * Module 16 — resolve install / share URL with honest fallback.
 */
import Constants from 'expo-constants';
import { Linking, Platform, Share } from 'react-native';

export type InstallUrlInfo = {
  url: string;
  configured: boolean;
  source: 'env' | 'linking' | 'fallback';
};

export function resolveInstallUrl(): InstallUrlInfo {
  const fromEnv = (process.env.EXPO_PUBLIC_INSTALL_URL ?? '').trim();
  if (fromEnv) return { url: fromEnv, configured: true, source: 'env' };

  const extraUrl = (Constants.expoConfig?.extra as { installUrl?: string } | undefined)?.installUrl;
  const linkingUri = (Constants as { linkingUri?: string }).linkingUri;
  const link =
    (typeof extraUrl === 'string' && extraUrl.trim()) ||
    (typeof linkingUri === 'string' && linkingUri.startsWith('http') ? linkingUri : null);
  if (link) {
    return { url: link, configured: true, source: 'linking' };
  }

  return {
    url: 'https://urgence-mecanique.app/install',
    configured: false,
    source: 'fallback',
  };
}

export async function openInstallUrl(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) return { ok: false, message: 'URL install non ouvrable sur cet appareil' };
    await Linking.openURL(url);
    return { ok: true, message: 'Lien install ouvert' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Échec ouverture lien' };
  }
}

/** Share-sheet "copy" path — no expo-clipboard dependency. */
export async function shareInstallLink(url: string, region: string): Promise<{ ok: boolean; message: string }> {
  const message = `Installe Urgence Mécanique (${region}) — Android / iOS / Web : ${url}`;
  try {
    const res = await Share.share({
      message,
      title: 'Lien install Urgence Mécanique',
      url: Platform.OS === 'ios' ? url : undefined,
    });
    if (res.action === Share.sharedAction) {
      return { ok: true, message: 'Lien install partagé' };
    }
    return { ok: false, message: 'Partage annulé' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Échec partage lien' };
  }
}
