/** Local + Firestore shapes for the referral program. */

export type ReferralEventDoc = {
  id: string;
  code: string;
  referrerUid: string;
  referredUid: string;
  createdAt: string;
  /** Referrer has applied discount + credits for this signup. */
  claimed: boolean;
};

export type ReferralCodeIndexDoc = {
  code: string;
  uid: string;
  createdAt: string;
};

export type ReferralRewardState = {
  referralRewardCredits: number;
  successfulReferralCount: number;
  referrerDiscountActive: boolean;
  referrerDiscountStartedAt: string | null;
  referrerDiscountEndsAt: string | null;
  /** Event ids already credited locally — prevents double-count on retry. */
  rewardedEventIds?: string[];
};
