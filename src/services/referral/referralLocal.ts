import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReferralEventDoc, ReferralRewardState } from './types';

const PENDING_KEY = 'um.referral.pendingCode.v1';
const REGISTRY_KEY = 'um.referral.localRegistry.v1';
const EVENTS_KEY = 'um.referral.localEvents.v1';
const REWARDS_KEY = 'um.referral.localRewards.v1';

/** Pending invite code captured from deep link / Compte before signup. */
export async function loadPendingReferralCode(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(PENDING_KEY);
    return v?.trim() ? v.trim().toUpperCase() : null;
  } catch {
    return null;
  }
}

export async function savePendingReferralCode(code: string | null): Promise<void> {
  try {
    if (!code?.trim()) {
      await AsyncStorage.removeItem(PENDING_KEY);
      return;
    }
    await AsyncStorage.setItem(PENDING_KEY, code.trim().toUpperCase());
  } catch {
    // soft-fail
  }
}

export async function clearPendingReferralCode(): Promise<void> {
  await savePendingReferralCode(null);
}

/** Local mock registry: referralCode → referrerUid (when Firestore is off / soft). */
export async function registerLocalReferralCode(code: string, uid: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(REGISTRY_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[code.toUpperCase()] = uid;
    await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(map));
  } catch {
    // soft-fail
  }
}

export async function lookupLocalReferrerUid(code: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(REGISTRY_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[code.toUpperCase()] ?? null;
  } catch {
    return null;
  }
}

export async function appendLocalReferralEvent(event: ReferralEventDoc): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    const list = raw ? (JSON.parse(raw) as ReferralEventDoc[]) : [];
    list.push(event);
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(list));
  } catch {
    // soft-fail
  }
}

export async function listLocalReferralEventsForReferrer(
  referrerUid: string,
): Promise<ReferralEventDoc[]> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    const list = raw ? (JSON.parse(raw) as ReferralEventDoc[]) : [];
    return list.filter((e) => e.referrerUid === referrerUid);
  } catch {
    return [];
  }
}

export async function markLocalReferralEventsClaimed(
  referrerUid: string,
  eventIds: string[],
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    const list = raw ? (JSON.parse(raw) as ReferralEventDoc[]) : [];
    const set = new Set(eventIds);
    const next = list.map((e) =>
      e.referrerUid === referrerUid && set.has(e.id) ? { ...e, claimed: true } : e,
    );
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(next));
  } catch {
    // soft-fail
  }
}

export async function loadLocalRewardState(uid: string): Promise<ReferralRewardState | null> {
  try {
    const raw = await AsyncStorage.getItem(REWARDS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, ReferralRewardState>;
    return map[uid] ?? null;
  } catch {
    return null;
  }
}

export async function saveLocalRewardState(uid: string, state: ReferralRewardState): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(REWARDS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, ReferralRewardState>) : {};
    map[uid] = state;
    await AsyncStorage.setItem(REWARDS_KEY, JSON.stringify(map));
  } catch {
    // soft-fail
  }
}
