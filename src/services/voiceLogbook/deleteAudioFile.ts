/**
 * Best-effort delete of a local voice recording URI (document/cache).
 */
import { File } from 'expo-file-system';

export async function deleteAudioFile(uri: string | null | undefined): Promise<void> {
  if (!uri || typeof uri !== 'string') return;
  // Blob URLs (web) are revoked separately if needed — File API is native-oriented.
  if (uri.startsWith('blob:')) {
    try {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(uri);
      }
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    /* missing / permission — ignore */
  }
}
