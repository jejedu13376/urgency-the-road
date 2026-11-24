/**
 * Module 12 — upload video to Firebase Storage (CDN path) when Auth + rules allow.
 * Soft-fails honestly when unsigned, bucket missing, or rules deny.
 */
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { getFirebase, getSignedInUid, isFirebaseConfigured } from '../../firebase/config';
import { isDevSoftAuth, isPermissionDenied } from '../firebase/devSoftAuth';
import { failResult, liveResult, mockResult, type ServiceResult } from '../firebase/result';

export type FeedVideoUpload = {
  downloadUrl: string | null;
  storagePath: string | null;
  contentType: string;
};

function guessContentType(fileName?: string): string {
  const n = (fileName ?? '').toLowerCase();
  if (n.endsWith('.mov')) return 'video/quicktime';
  if (n.endsWith('.webm')) return 'video/webm';
  if (n.endsWith('.mkv')) return 'video/x-matroska';
  return 'video/mp4';
}

/**
 * Upload a local video URI to `feedVideos/{uid}/{stamp}-{safeName}`.
 */
export async function uploadFeedVideo(opts: {
  localUri: string;
  fileName?: string;
}): Promise<ServiceResult<FeedVideoUpload>> {
  const uid = getSignedInUid();
  if (!isFirebaseConfigured() || !getFirebase()) {
    return mockResult(
      { downloadUrl: null, storagePath: null, contentType: guessContentType(opts.fileName) },
      'MOCK CDN — Firebase off ; vidéo reste on-device',
    );
  }
  if (!uid) {
    return failResult(
      { downloadUrl: null, storagePath: null, contentType: guessContentType(opts.fileName) },
      'CDN refusé — connectez-vous (Auth) avant upload vidéo',
    );
  }

  const bucket = (process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '').trim();
  if (!bucket) {
    return failResult(
      { downloadUrl: null, storagePath: null, contentType: guessContentType(opts.fileName) },
      'CDN refusé — EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET manquant',
    );
  }

  const safeName = (opts.fileName ?? 'clip.mp4').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const storagePath = `feedVideos/${uid}/${Date.now()}-${safeName}`;
  const contentType = guessContentType(safeName);

  try {
    const fb = getFirebase()!;
    const storage = getStorage(fb.app);
    const objectRef = ref(storage, storagePath);

    const res = await fetch(opts.localUri);
    if (!res.ok) {
      return failResult(
        { downloadUrl: null, storagePath, contentType },
        `Lecture fichier locale échouée (HTTP ${res.status})`,
      );
    }
    const blob = await res.blob();
    await uploadBytes(objectRef, blob, { contentType });
    const downloadUrl = await getDownloadURL(objectRef);
    return liveResult(
      { downloadUrl, storagePath, contentType },
      `CDN LIVE — Storage ${storagePath}`,
    );
  } catch (e) {
    if (isPermissionDenied(e) || isDevSoftAuth()) {
      return failResult(
        { downloadUrl: null, storagePath, contentType },
        isPermissionDenied(e)
          ? 'SOFT CDN — Storage permission refusée (rules / deploy). Fichier reste on-device.'
          : 'SOFT CDN — DEV soft-auth ; upload non simulé. Fichier reste on-device.',
      );
    }
    return failResult(
      { downloadUrl: null, storagePath, contentType },
      e instanceof Error ? e.message : 'Upload CDN échoué',
    );
  }
}

export const VIDEO_CDN_READY =
  'Upload CDN Firebase Storage branché — Auth + storage.rules owner-path requis ; soft-fail sinon.';
