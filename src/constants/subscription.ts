/**
 * App subscription — Premium catalog + referrer invite discount.
 *
 * Pricing rules (enforced here + Compte / checkout / auth profile flags):
 * - Everyone (including referred signups) pays standard Premium $15 / month.
 * - Referrers (who successfully invite someone) get $12 / month for the first
 *   REFERRER_DISCOUNT_MONTHS months after the reward is applied, then $15.
 * Stripe Payment Links / RevenueCat offerings should match these placeholders.
 */

export const PREMIUM_PLAN_ID = 'premium' as const;

/** Standard catalog price in USD — referred users and post-window referrers. */
export const PREMIUM_PRICE_MONTHLY_USD = 15;

/**
 * Referrer (inviter) discounted price during the reward window.
 * Not applied to the referred signup — only to the account that shared the code.
 */
export const REFERRER_DISCOUNT_PRICE_MONTHLY_USD = 12;

/** Length of the referrer $12/mo window after a successful referral reward. */
export const REFERRER_DISCOUNT_MONTHS = 3;

export const PREMIUM_CURRENCY = 'USD' as const;

/** Human-readable price strings used in UI / checkout hints. */
export const PREMIUM_PRICE_LABEL = '$15';
export const PREMIUM_PRICE_PER_MONTH_LABEL = '$15/month';
export const REFERRER_DISCOUNT_PRICE_LABEL = '$12';
export const REFERRER_DISCOUNT_PRICE_PER_MONTH_LABEL = '$12/month';

/** XP / in-app credit granted to the referrer when a signup uses their code. */
export const REFERRAL_SIGNUP_REWARD_CREDITS = 100;

/**
 * Placeholders for store / billing product ids — replace with live Stripe / RevenueCat ids.
 * Standard amount must stay $15/month; referrer promo placeholder stays $12/month.
 */
export const STRIPE_PREMIUM_PRICE_PLACEHOLDER = 'price_premium_15_usd_month';
export const STRIPE_REFERRER_DISCOUNT_PRICE_PLACEHOLDER = 'price_premium_referrer_12_usd_month';
export const REVENUECAT_PREMIUM_ENTITLEMENT_PLACEHOLDER = 'premium';
export const REVENUECAT_PREMIUM_PACKAGE_PLACEHOLDER = '$rc_monthly';
export const REVENUECAT_PREMIUM_PRODUCT_IOS_PLACEHOLDER = 'urgency_road_premium_monthly_15';
export const REVENUECAT_PREMIUM_PRODUCT_ANDROID_PLACEHOLDER = 'urgency_road_premium_monthly_15';
export const REVENUECAT_REFERRER_DISCOUNT_PRODUCT_IOS_PLACEHOLDER =
  'urgency_road_premium_referrer_monthly_12';
export const REVENUECAT_REFERRER_DISCOUNT_PRODUCT_ANDROID_PLACEHOLDER =
  'urgency_road_premium_referrer_monthly_12';

export type PremiumPriceQuote = {
  amountUsdMonthly: number;
  priceLabel: string;
  stripePriceId: string;
  /** True when the signed-in user currently has an active referrer discount window. */
  referrerDiscountActive: boolean;
  /** ISO end of discount window, if any. */
  referrerDiscountEndsAt: string | null;
};

/** Add calendar months to an ISO timestamp (UTC day-safe enough for billing windows). */
export function addMonthsIso(fromIso: string, months: number): string {
  const d = new Date(fromIso);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp overflow (e.g. Jan 31 + 1 month)
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString();
}

export function isReferrerDiscountWindowActive(
  endsAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!endsAt) return false;
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) return false;
  return end > now.getTime();
}

/**
 * Resolve checkout / display price for the signed-in user.
 * Referred flag alone never lowers price — only an active referrer discount window does.
 */
export function resolvePremiumPriceQuote(opts: {
  referrerDiscountEndsAt?: string | null;
  now?: Date;
}): PremiumPriceQuote {
  const active = isReferrerDiscountWindowActive(opts.referrerDiscountEndsAt, opts.now ?? new Date());
  if (active) {
    return {
      amountUsdMonthly: REFERRER_DISCOUNT_PRICE_MONTHLY_USD,
      priceLabel: REFERRER_DISCOUNT_PRICE_PER_MONTH_LABEL,
      stripePriceId: STRIPE_REFERRER_DISCOUNT_PRICE_PLACEHOLDER,
      referrerDiscountActive: true,
      referrerDiscountEndsAt: opts.referrerDiscountEndsAt ?? null,
    };
  }
  return {
    amountUsdMonthly: PREMIUM_PRICE_MONTHLY_USD,
    priceLabel: PREMIUM_PRICE_PER_MONTH_LABEL,
    stripePriceId: STRIPE_PREMIUM_PRICE_PLACEHOLDER,
    referrerDiscountActive: false,
    referrerDiscountEndsAt: opts.referrerDiscountEndsAt ?? null,
  };
}

export function formatPremiumPriceMonthly(localeHint?: string, amountUsd = PREMIUM_PRICE_MONTHLY_USD): string {
  if (localeHint?.toLowerCase().startsWith('fr')) {
    return `${amountUsd} $ / mois`;
  }
  if (localeHint?.toLowerCase().startsWith('es')) {
    return `${amountUsd} $ / mes`;
  }
  return `$${amountUsd}/month`;
}
