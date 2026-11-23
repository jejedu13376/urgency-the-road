/**
 * Module 12 — local comments + likes persistence (text fil).
 * Video CDN remains out of scope.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const COMMENTS_KEY = 'um.fil.comments.v1';
const LIKES_KEY = 'um.fil.likes.v1';

export type LocalComment = { id: string; author: string; text: string; at: string };

export async function loadComments(): Promise<Record<string, LocalComment[]>> {
  try {
    const raw = await AsyncStorage.getItem(COMMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LocalComment[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveComments(map: Record<string, LocalComment[]>): Promise<void> {
  await AsyncStorage.setItem(COMMENTS_KEY, JSON.stringify(map));
}

export async function loadLiked(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(LIKES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveLiked(map: Record<string, boolean>): Promise<void> {
  await AsyncStorage.setItem(LIKES_KEY, JSON.stringify(map));
}
