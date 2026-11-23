/**
 * Share a local voice note with other truckers (OS share sheet + Fil caption).
 * Audio files stay on-device — no CDN upload (same honesty as Fil vidéo locale).
 */
import { Platform, Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { createTextFeedPost } from '../firebase/feedService';
import { formatDurationMs, type VoiceLogNote, updateVoiceNote } from './voiceLogbookStorage';

function buildShareMessage(note: VoiceLogNote): string {
  const lines = [
    'URGENCE MÉCANIQUE — note vocale après trajet',
    note.title,
    note.tripLabel ? `Destination : ${note.tripLabel}` : null,
    note.vehicleMode ? `Mode : ${note.vehicleMode}` : null,
    `Durée : ${formatDurationMs(note.durationMs)}`,
    note.tripLat != null && note.tripLon != null
      ? `Coords : ${note.tripLat.toFixed(5)}, ${note.tripLon.toFixed(5)}`
      : null,
    '',
    'Fichier audio local joint si le partage OS le permet — pas d’upload CDN.',
  ];
  return lines.filter((l) => l != null).join('\n');
}

/** Share the audio file (preferred) or fall back to text caption. */
export async function shareVoiceNoteFile(note: VoiceLogNote): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const can = await Sharing.isAvailableAsync();
    if (can && note.uri) {
      await Sharing.shareAsync(note.uri, {
        mimeType: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4',
        UTI: 'public.audio',
        dialogTitle: 'Partager note vocale trajets',
      });
      return { ok: true, message: 'Fichier audio proposé au partage OS (camionneurs / WhatsApp / mail).' };
    }
    const res = await Share.share({
      message: buildShareMessage(note),
      title: note.title,
      url: Platform.OS === 'ios' ? note.uri : undefined,
    });
    if (res.action === Share.sharedAction) {
      return { ok: true, message: 'Note vocale partagée (texte / URI selon OS).' };
    }
    return { ok: false, message: 'Partage annulé.' };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Échec partage note vocale',
    };
  }
}

/** Publish a Fil caption so other truckers see the tip; audio remains local. */
export async function shareVoiceNoteToFeed(
  note: VoiceLogNote,
  authorName?: string,
): Promise<{ ok: boolean; message: string }> {
  const caption = [
    `[note vocale trajet · ${formatDurationMs(note.durationMs)}]`,
    note.tripLabel ? `Arrivée : ${note.tripLabel}` : null,
    note.title,
    'Audio on-device uniquement — CDN audio non branché (comme Fil vidéo locale).',
  ]
    .filter(Boolean)
    .join('\n');

  const res = await createTextFeedPost({
    title: note.title || 'Note vocale trajet',
    caption,
    authorName,
  });

  if (res.ok !== false && res.data) {
    await updateVoiceNote(note.id, { sharedToFeedAt: new Date().toISOString() });
  }

  return {
    ok: res.ok !== false,
    message:
      res.stubLabel ??
      (res.ok !== false
        ? 'Publié sur le Fil (méta texte) — fichier audio reste local'
        : 'Échec publication Fil'),
  };
}
