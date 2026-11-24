/**
 * App subscription — single Premium plan at $15 / month.
 * Stripe Payment Links / RevenueCat offerings should match these placeholders.
 */

export const PREMIUM_PLAN_ID = 'premium' as const;

/** Display / catalog price in USD. */
export const PREMIUM_PRICE_MONTHLY_USD = 15;

export const PREMIUM_CURRENCY = 'USD' as const;

/** Human-readable price strings used in UI / checkout hints. */
export const PREMIUM_PRICE_LABEL = '$15';
export const PREMIUM_PRICE_PER_MONTH_LABEL = '$15/month';

/**
 * Placeholders for store / billing product ids — replace with live Stripe / RevenueCat ids.
 * Amount must stay $15/month (15 USD).
 */
export const STRIPE_PREMIUM_PRICE_PLACEHOLDER = 'price_premium_15_usd_month';
export const REVENUECAT_PREMIUM_ENTITLEMENT_PLACEHOLDER = 'premium';
export const REVENUECAT_PREMIUM_PACKAGE_PLACEHOLDER = '$rc_monthly';
export const REVENUECAT_PREMIUM_PRODUCT_IOS_PLACEHOLDER = 'urgency_road_premium_monthly_15';
export const REVENUECAT_PREMIUM_PRODUCT_ANDROID_PLACEHOLDER = 'urgency_road_premium_monthly_15';

export function formatPremiumPriceMonthly(localeHint?: string): string {
  const amount = PREMIUM_PRICE_MONTHLY_USD;
  if (localeHint?.toLowerCase().startsWith('fr')) {
    return `${amount} $ / mois`;
  }
  if (localeHint?.toLowerCase().startsWith('es')) {
    return `${amount} $ / mes`;
  }
  return `$${amount}/month`;
}
