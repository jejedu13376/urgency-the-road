/**
 * Module 12 — pick a local video from the library (no CDN upload).
 * Metadata can annotate a text post; binary stays on-device.
 */
import * as ImagePicker from 'expo-image-picker';

export type LocalVideoPick =
  | { ok: true; uri: string; durationSec?: number; fileName?: string; label: string }
  | { ok: false; label: string };

export async function pickLocalVideo(): Promise<LocalVideoPick> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return {
      ok: false,
      label: 'Permission médiathèque refusée — aucun fichier vidéo sélectionné / uploadé.',
    };
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing: false,
    quality: 1,
  });

  if (res.canceled || !res.assets?.[0]?.uri) {
    return { ok: false, label: 'Sélection vidéo annulée — CDN non sollicité.' };
  }

  const asset = res.assets[0];
  // expo-image-picker documents duration in milliseconds.
  const durationSec =
    typeof asset.duration === 'number' && Number.isFinite(asset.duration) && asset.duration >= 0
      ? Math.max(0, Math.round(asset.duration / 1000))
      : undefined;

  return {
    ok: true,
    uri: asset.uri,
    durationSec,
    fileName: asset.fileName ?? undefined,
    label: `Vidéo locale sélectionnée${
      durationSec != null ? ` · ~${durationSec}s` : ''
    } — clip prêt ; upload CDN à la publication (Auth + rules).`,
  };
}

/** @deprecated Prefer VIDEO_CDN_READY — upload path exists; soft-fail without Auth/rules. */
export const VIDEO_CDN_BLOCKED =
  'Upload CDN Firebase Storage branché — Auth + rules owner-path ; soft-fail si refusé (fichier reste on-device).';

export { VIDEO_CDN_READY } from './uploadFeedVideo';
