/**
 * Referral program — per-user code/link, signup attribution, referrer rewards.
 *
 * Reward model:
 * - Referred signup pays standard Premium ($15/mo).
 * - Referrer earns REFERRAL_SIGNUP_REWARD_CREDITS + $12/mo for REFERRER_DISCOUNT_MONTHS.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  REFERRAL_SIGNUP_REWARD_CREDITS,
  REFERRER_DISCOUNT_MONTHS,
  addMonthsIso,
  isReferrerDiscountWindowActive,
  resolvePremiumPriceQuote,
  type PremiumPriceQuote,
} from '../../constants/subscription';
import { getFirebase, isFirebaseConfigured } from '../../firebase/config';
import type { UserDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { isDevSoftAuth, isPermissionDenied } from '../firebase/devSoftAuth';
import { failResult, liveResult, mockResult, type ServiceResult } from '../firebase/result';
import { resolveInstallUrl } from '../share/installUrl';
import {
  buildReferralLink,
  generateReferralCode,
  isValidReferralCodeShape,
  normalizeReferralCode,
  parseReferralCodeFromUrl,
} from './referralCode';
import {
  appendLocalReferralEvent,
  clearPendingReferralCode,
  listLocalReferralEventsForReferrer,
  loadLocalRewardState,
  loadPendingReferralCode,
  lookupLocalReferrerUid,
  markLocalReferralEventsClaimed,
  registerLocalReferralCode,
  saveLocalRewardState,
  savePendingReferralCode,
} from './referralLocal';
import type { ReferralEventDoc, ReferralRewardState } from './types';

export {
  buildReferralLink,
  generateReferralCode,
  normalizeReferralCode,
  parseReferralCodeFromUrl,
  isValidReferralCodeShape,
};
export { loadPendingReferralCode, savePendingReferralCode, clearPendingReferralCode };

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Ensure profile has a referral code (local registry + optional Firestore index). */
export async function ensureUserReferralCode(profile: UserDoc): Promise<UserDoc> {
  const code = profile.referralCode?.trim()
    ? normalizeReferralCode(profile.referralCode)
    : generateReferralCode(profile.uid);
  const next: UserDoc = { ...profile, referralCode: code };
  await registerLocalReferralCode(code, profile.uid);

  const fb = getFirebase();
  if (!fb || !isFirebaseConfigured()) return next;

  try {
    const userRef = doc(fb.db, COLLECTIONS.users, profile.uid);
    const indexRef = doc(fb.db, COLLECTIONS.referralCodes, code);
    if (!profile.referralCode) {
      await updateDoc(userRef, { referralCode: code, updatedAt: serverTimestamp() });
    }
    const snap = await getDoc(indexRef);
    if (!snap.exists()) {
      await setDoc(
        indexRef,
        stripUndefined({
          code,
          uid: profile.uid,
          createdAt: serverTimestamp(),
        }),
      );
    }
  } catch (e) {
    if (!(isPermissionDenied(e) || isDevSoftAuth())) {
      // soft — keep local code
    }
  }
  return next;
}

export function referralLinkForCode(code: string): string {
  const install = resolveInstallUrl();
  if (!install.configured) return '';
  return buildReferralLink(install.url, code);
}

export function checkoutQuoteForProfile(profile: UserDoc | null | undefined): PremiumPriceQuote {
  return resolvePremiumPriceQuote({
    referrerDiscountEndsAt: profile?.referrerDiscountEndsAt ?? null,
  });
}

async function lookupReferrerByCode(code: string): Promise<{ uid: string; source: 'firebase' | 'mock' } | null> {
  const clean = normalizeReferralCode(code);
  if (!isValidReferralCodeShape(clean)) return null;

  const fb = getFirebase();
  if (fb && isFirebaseConfigured()) {
    try {
      const snap = await getDoc(doc(fb.db, COLLECTIONS.referralCodes, clean));
      if (snap.exists()) {
        const uid = String((snap.data() as { uid?: string }).uid ?? '');
        if (uid) return { uid, source: 'firebase' };
      }
    } catch (e) {
      if (!(isPermissionDenied(e) || isDevSoftAuth())) {
        // fall through to local
      }
    }
  }

  const localUid = await lookupLocalReferrerUid(clean);
  if (localUid) return { uid: localUid, source: 'mock' };
  return null;
}

/**
 * Apply a referral code on new signup.
 * Sets referredBy* on the new user; records an event for the referrer to claim.
 * Does NOT give the referred user a price discount (they pay $15).
 */
export async function applyReferralOnSignup(
  newUser: UserDoc,
  rawCode: string | null | undefined,
): Promise<ServiceResult<UserDoc>> {
  const clean = rawCode ? normalizeReferralCode(rawCode) : '';
  if (!clean) {
    await clearPendingReferralCode();
    return liveResult(newUser);
  }
  if (!isValidReferralCodeShape(clean)) {
    return failResult(newUser, 'Code de parrainage invalide');
  }

  const hit = await lookupReferrerByCode(clean);
  if (!hit) {
    return failResult(newUser, 'Code de parrainage introuvable');
  }
  if (hit.uid === newUser.uid) {
    return failResult(newUser, 'Vous ne pouvez pas utiliser votre propre code');
  }

  const now = new Date().toISOString();
  const updated: UserDoc = {
    ...newUser,
    referredByCode: clean,
    referredByUid: hit.uid,
    updatedAt: now,
  };

  const event: ReferralEventDoc = {
    id: `ref-${hit.uid}-${newUser.uid}-${Date.now()}`,
    code: clean,
    referrerUid: hit.uid,
    referredUid: newUser.uid,
    createdAt: now,
    claimed: false,
  };
  await appendLocalReferralEvent(event);

  const fb = getFirebase();
  if (fb && isFirebaseConfigured()) {
    try {
      const userRef = doc(fb.db, COLLECTIONS.users, newUser.uid);
      await updateDoc(
        userRef,
        stripUndefined({
          referredByCode: clean,
          referredByUid: hit.uid,
          updatedAt: serverTimestamp(),
        }),
      );
      const eventRef = doc(fb.db, COLLECTIONS.referralEvents, event.id);
      await setDoc(
        eventRef,
        stripUndefined({
          ...event,
          createdAt: serverTimestamp(),
        }),
      );
    } catch (e) {
      if (!(isPermissionDenied(e) || isDevSoftAuth())) {
        // keep local attribution
      }
    }
  }

  await clearPendingReferralCode();
  return hit.source === 'mock'
    ? mockResult(updated, 'Parrainage enregistré (local) — le parrain reçoit $12/mois × 3 mois + crédits')
    : liveResult(updated, 'Parrainage enregistré — le parrain reçoit $12/mois × 3 mois + crédits');
}

function emptyRewardState(): ReferralRewardState {
  return {
    referralRewardCredits: 0,
    successfulReferralCount: 0,
    referrerDiscountActive: false,
    referrerDiscountStartedAt: null,
    referrerDiscountEndsAt: null,
  };
}

function mergeRewardOnClaim(
  prev: ReferralRewardState,
  claimCount: number,
  nowIso: string,
): ReferralRewardState {
  if (claimCount <= 0) return prev;
  const credits = prev.referralRewardCredits + claimCount * REFERRAL_SIGNUP_REWARD_CREDITS;
  const successfulReferralCount = prev.successfulReferralCount + claimCount;
  // Extend / (re)start the 3-month $12 window from now for each claim batch.
  const startedAt = nowIso;
  const endsAt = addMonthsIso(nowIso, REFERRER_DISCOUNT_MONTHS);
  return {
    referralRewardCredits: credits,
    successfulReferralCount,
    referrerDiscountActive: true,
    referrerDiscountStartedAt: startedAt,
    referrerDiscountEndsAt: endsAt,
  };
}

/**
 * Referrer claims unclaimed signup events → credits + $12/mo for 3 months.
 * Safe to call on Compte / Parrainage open.
 */
export async function claimReferralRewards(profile: UserDoc): Promise<
  ServiceResult<{ profile: UserDoc; claimed: number; creditsAdded: number }>
> {
  const nowIso = new Date().toISOString();
  let unclaimed: ReferralEventDoc[] = await listLocalReferralEventsForReferrer(profile.uid).then((list) =>
    list.filter((e) => !e.claimed),
  );

  const fb = getFirebase();
  if (fb && isFirebaseConfigured()) {
    try {
      const q = query(
        collection(fb.db, COLLECTIONS.referralEvents),
        where('referrerUid', '==', profile.uid),
        where('claimed', '==', false),
      );
      const snap = await getDocs(q);
      const cloud: ReferralEventDoc[] = snap.docs.map((d) => {
        const data = d.data() as ReferralEventDoc;
        return { ...data, id: d.id };
      });
      const byId = new Map<string, ReferralEventDoc>();
      for (const e of [...unclaimed, ...cloud]) byId.set(e.id, e);
      unclaimed = [...byId.values()].filter((e) => !e.claimed);
    } catch (e) {
      if (!(isPermissionDenied(e) || isDevSoftAuth())) {
        // keep local list
      }
    }
  }

  if (unclaimed.length === 0) {
    // Refresh active flag from endsAt even when nothing to claim.
    const endsAt = profile.referrerDiscountEndsAt ?? null;
    const active = isReferrerDiscountWindowActive(endsAt);
    const synced: UserDoc = {
      ...profile,
      referrerDiscountActive: active,
    };
    return liveResult({ profile: synced, claimed: 0, creditsAdded: 0 });
  }

  const localPrev =
    (await loadLocalRewardState(profile.uid)) ??
    ({
      referralRewardCredits: profile.referralRewardCredits ?? 0,
      successfulReferralCount: profile.successfulReferralCount ?? 0,
      referrerDiscountActive: Boolean(profile.referrerDiscountActive),
      referrerDiscountStartedAt: profile.referrerDiscountStartedAt ?? null,
      referrerDiscountEndsAt: profile.referrerDiscountEndsAt ?? null,
    } satisfies ReferralRewardState);

  const nextReward = mergeRewardOnClaim(localPrev, unclaimed.length, nowIso);
  await saveLocalRewardState(profile.uid, nextReward);
  await markLocalReferralEventsClaimed(
    profile.uid,
    unclaimed.map((e) => e.id),
  );

  if (fb && isFirebaseConfigured()) {
    try {
      for (const e of unclaimed) {
        await updateDoc(doc(fb.db, COLLECTIONS.referralEvents, e.id), { claimed: true });
      }
      await updateDoc(
        doc(fb.db, COLLECTIONS.users, profile.uid),
        stripUndefined({
          referralRewardCredits: nextReward.referralRewardCredits,
          successfulReferralCount: nextReward.successfulReferralCount,
          referrerDiscountActive: true,
          referrerDiscountStartedAt: nextReward.referrerDiscountStartedAt,
          referrerDiscountEndsAt: nextReward.referrerDiscountEndsAt,
          updatedAt: serverTimestamp(),
        }),
      );
    } catch (e) {
      if (!(isPermissionDenied(e) || isDevSoftAuth())) {
        // local reward still applied
      }
    }
  }

  const creditsAdded = unclaimed.length * REFERRAL_SIGNUP_REWARD_CREDITS;
  const updated: UserDoc = {
    ...profile,
    referralRewardCredits: nextReward.referralRewardCredits,
    successfulReferralCount: nextReward.successfulReferralCount,
    referrerDiscountActive: true,
    referrerDiscountStartedAt: nextReward.referrerDiscountStartedAt ?? undefined,
    referrerDiscountEndsAt: nextReward.referrerDiscountEndsAt ?? undefined,
    updatedAt: nowIso,
  };

  return mockResult(
    { profile: updated, claimed: unclaimed.length, creditsAdded },
    `Récompense parrain : +${creditsAdded} crédits · $12/mois pendant ${REFERRER_DISCOUNT_MONTHS} mois`,
  );
}

/** Hydrate profile with local reward state when Firestore soft-fails. */
export async function hydrateReferralFields(profile: UserDoc): Promise<UserDoc> {
  const withCode = await ensureUserReferralCode(profile);
  const local = await loadLocalRewardState(profile.uid);
  if (!local) {
    return {
      ...withCode,
      referrerDiscountActive: isReferrerDiscountWindowActive(withCode.referrerDiscountEndsAt),
    };
  }
  const endsAt = local.referrerDiscountEndsAt ?? withCode.referrerDiscountEndsAt ?? null;
  return {
    ...withCode,
    referralRewardCredits: Math.max(withCode.referralRewardCredits ?? 0, local.referralRewardCredits),
    successfulReferralCount: Math.max(
      withCode.successfulReferralCount ?? 0,
      local.successfulReferralCount,
    ),
    referrerDiscountStartedAt:
      local.referrerDiscountStartedAt ?? withCode.referrerDiscountStartedAt,
    referrerDiscountEndsAt: endsAt ?? undefined,
    referrerDiscountActive: isReferrerDiscountWindowActive(endsAt),
  };
}

export async function captureReferralFromUrl(url: string): Promise<string | null> {
  const code = parseReferralCodeFromUrl(url);
  if (!code) return null;
  await savePendingReferralCode(code);
  return code;
}

export function emptyLocalRewardHint(): ReferralRewardState {
  return emptyRewardState();
}
