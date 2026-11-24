/**
 * Module 16 — resolve install / share URL with honest fallback (no fake store URL).
 */
import Constants from 'expo-constants';
import * as ExpoLinking from 'expo-linking';
import { Linking, Platform, Share } from 'react-native';
import {
  UNSET_INSTALL_PLACEHOLDER,
  pickInstallUrl,
  type InstallUrlInfo,
} from './installUrlCore';

export type { InstallUrlInfo } from './installUrlCore';

export function resolveInstallUrl(): InstallUrlInfo {
  const extraUrl = (Constants.expoConfig?.extra as { installUrl?: string } | undefined)?.installUrl;
  const linkingUri = (Constants as { linkingUri?: string }).linkingUri;
  let expoUrl: string | null = null;
  try {
    const created = ExpoLinking.createURL('/');
    if (typeof created === 'string' && created.trim()) expoUrl = created;
  } catch {
    expoUrl = null;
  }
  return pickInstallUrl({
    envUrl: process.env.EXPO_PUBLIC_INSTALL_URL,
    extraUrl,
    linkingUri,
    expoUrl,
  });
}

export { UNSET_INSTALL_PLACEHOLDER };

export async function openInstallUrl(url: string): Promise<{ ok: boolean; message: string }> {
  if (!url.startsWith('http')) {
    return { ok: false, message: 'Lien install non configuré — définissez EXPO_PUBLIC_INSTALL_URL' };
  }
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) return { ok: false, message: 'URL install non ouvrable sur cet appareil' };
    await Linking.openURL(url);
    return { ok: true, message: 'Lien install ouvert' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Échec ouverture lien' };
  }
}

/** Share-sheet path — refuses when install URL is unset (no fabricated store link). */
export async function shareInstallLink(url: string, region: string): Promise<{ ok: boolean; message: string }> {
  if (!url.startsWith('http')) {
    return {
      ok: false,
      message: 'Partage refusé — définissez EXPO_PUBLIC_INSTALL_URL (aucun listing inventé)',
    };
  }
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
