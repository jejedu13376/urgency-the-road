/**
 * Module 15 payments — Stripe (cartes), PayPal, Apple Pay, Google Pay.
 * No Lydia. Never reports success without real config / URL / native wallet path.
 *
 * Catalog:
 * - Standard Premium = $15/month (referred users + default).
 * - Referrer discount = $12/month for REFERRER_DISCOUNT_MONTHS after a successful invite.
 * Prices resolved via src/constants/subscription.ts (resolvePremiumPriceQuote).
 */
import * as Linking from 'expo-linking';
import {
  PREMIUM_PLAN_ID,
  PREMIUM_PRICE_MONTHLY_USD,
  PREMIUM_PRICE_PER_MONTH_LABEL,
  REVENUECAT_PREMIUM_ENTITLEMENT_PLACEHOLDER,
  REVENUECAT_PREMIUM_PACKAGE_PLACEHOLDER,
  REVENUECAT_PREMIUM_PRODUCT_ANDROID_PLACEHOLDER,
  REVENUECAT_PREMIUM_PRODUCT_IOS_PLACEHOLDER,
  STRIPE_PREMIUM_PRICE_PLACEHOLDER,
  resolvePremiumPriceQuote,
  type PremiumPriceQuote,
} from '../../constants/subscription';

export type PayPlanId = string;
export type PlanId = PayPlanId;

/** Default checkout plan — Premium $15/month (or $12 when referrer window active). */
export const DEFAULT_PLAN_ID: PlanId = PREMIUM_PLAN_ID;

/** Stripe / RevenueCat placeholders (replace with live ids; keep amounts in sync). */
export const PAYMENT_PRODUCT_PLACEHOLDERS = {
  stripePriceId: STRIPE_PREMIUM_PRICE_PLACEHOLDER,
  revenueCatEntitlement: REVENUECAT_PREMIUM_ENTITLEMENT_PLACEHOLDER,
  revenueCatPackage: REVENUECAT_PREMIUM_PACKAGE_PLACEHOLDER,
  revenueCatProductIos: REVENUECAT_PREMIUM_PRODUCT_IOS_PLACEHOLDER,
  revenueCatProductAndroid: REVENUECAT_PREMIUM_PRODUCT_ANDROID_PLACEHOLDER,
  amountUsdMonthly: PREMIUM_PRICE_MONTHLY_USD,
  priceLabel: PREMIUM_PRICE_PER_MONTH_LABEL,
} as const;

export type PaymentMethod = 'stripe_card' | 'paypal' | 'apple_pay' | 'google_pay';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'stripe_card', label: 'Stripe · carte bancaire', hint: 'Visa / Mastercard / Amex via Checkout' },
  { id: 'paypal', label: 'PayPal', hint: 'Compte PayPal ou carte via PayPal' },
  { id: 'apple_pay', label: 'Apple Pay', hint: 'Wallet iOS (Dev Client / store build)' },
  { id: 'google_pay', label: 'Google Pay', hint: 'Wallet Android (Dev Client / store build)' },
];

export type PaymentAttempt = {
  ok: boolean;
  provider: PaymentMethod | 'none';
  checkoutUrl: string | null;
  message: string;
  configured: boolean;
};

export type CheckoutPriceOpts = {
  /** From Auth profile — drives $12 vs $15. */
  referrerDiscountEndsAt?: string | null;
  /** Explicit override (tests). */
  quote?: PremiumPriceQuote;
};

function quoteForCheckout(opts?: CheckoutPriceOpts): PremiumPriceQuote {
  if (opts?.quote) return opts.quote;
  return resolvePremiumPriceQuote({
    referrerDiscountEndsAt: opts?.referrerDiscountEndsAt ?? null,
  });
}

function stripeBase(): string {
  return (process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_BASE ?? '').trim().replace(/\/$/, '');
}

function paypalBase(): string {
  return (process.env.EXPO_PUBLIC_PAYPAL_CHECKOUT_BASE ?? '').trim().replace(/\/$/, '');
}

function revenueCatKey(): string {
  return (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '').trim();
}

export function isPaymentsConfigured(): boolean {
  return Boolean(stripeBase() || paypalBase() || revenueCatKey());
}

export function isMethodConfigured(method: PaymentMethod): boolean {
  if (method === 'stripe_card') return Boolean(stripeBase());
  if (method === 'paypal') return Boolean(paypalBase());
  // Apple / Google Pay via Stripe Checkout wallets or RevenueCat IAP — need base or RC key
  if (method === 'apple_pay' || method === 'google_pay') {
    return Boolean(stripeBase() || revenueCatKey());
  }
  return false;
}

export function paymentsStatusLabel(): string {
  const parts: string[] = [];
  if (stripeBase()) parts.push('Stripe cartes');
  if (paypalBase()) parts.push('PayPal');
  if (stripeBase() || revenueCatKey()) parts.push('Apple/Google Pay (via Stripe/RC)');
  if (parts.length) return `Paiements : ${parts.join(' · ')}`;
  return 'Paiements non configurés — Stripe / PayPal / wallets (aucun succès simulé)';
}

export function paymentsConfigLabel(): string {
  return paymentsStatusLabel();
}

async function openCheckoutUrl(
  url: string,
  provider: PaymentMethod,
  planId: string,
): Promise<PaymentAttempt> {
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      return {
        ok: false,
        provider,
        checkoutUrl: url,
        configured: true,
        message: `URL non ouvrable (${provider}) : ${url}`,
      };
    }
    await Linking.openURL(url);
    return {
      ok: true,
      provider,
      checkoutUrl: url,
      configured: true,
      message: `Checkout ${provider} ouvert pour « ${planId} ».`,
    };
  } catch (e) {
    return {
      ok: false,
      provider,
      checkoutUrl: url,
      configured: true,
      message: e instanceof Error ? e.message : `Échec ouverture ${provider}`,
    };
  }
}

/**
 * Start checkout for a plan + method. No fake success without config.
 * Price comes from subscription constants + optional referrer discount window.
 */
export async function startCheckout(
  planId: PayPlanId,
  method: PaymentMethod = 'stripe_card',
  priceOpts?: CheckoutPriceOpts,
): Promise<PaymentAttempt> {
  const quote = quoteForCheckout(priceOpts);
  const price = quote.amountUsdMonthly;
  const stripePrice = quote.stripePriceId;
  const refFlag = quote.referrerDiscountActive ? '1' : '0';

  if (method === 'stripe_card') {
    const base = stripeBase();
    if (!base) {
      return {
        ok: false,
        provider: 'stripe_card',
        checkoutUrl: null,
        configured: false,
        message:
          'Stripe cartes : définir EXPO_PUBLIC_STRIPE_CHECKOUT_BASE (Payment Link / Checkout). Aucun succès fictif.',
      };
    }
    const url = `${base}?plan=${encodeURIComponent(planId)}&price=${price}&currency=USD&stripe_price=${encodeURIComponent(stripePrice)}&method=card&referrer_discount=${refFlag}&utm_source=urgence_mecanique`;
    return openCheckoutUrl(url, 'stripe_card', planId);
  }

  if (method === 'paypal') {
    const base = paypalBase();
    if (!base) {
      return {
        ok: false,
        provider: 'paypal',
        checkoutUrl: null,
        configured: false,
        message:
          'PayPal : définir EXPO_PUBLIC_PAYPAL_CHECKOUT_BASE (lien Checkout / Hosted). Aucun succès fictif.',
      };
    }
    const url = `${base}?plan=${encodeURIComponent(planId)}&price=${price}&currency=USD&referrer_discount=${refFlag}&utm_source=urgence_mecanique`;
    return openCheckoutUrl(url, 'paypal', planId);
  }

  if (method === 'apple_pay' || method === 'google_pay') {
    const base = stripeBase();
    if (base) {
      const wallet = method === 'apple_pay' ? 'apple_pay' : 'google_pay';
      const url = `${base}?plan=${encodeURIComponent(planId)}&price=${price}&currency=USD&stripe_price=${encodeURIComponent(stripePrice)}&method=${wallet}&referrer_discount=${refFlag}&utm_source=urgence_mecanique`;
      return openCheckoutUrl(url, method, planId);
    }
    if (revenueCatKey()) {
      return {
        ok: false,
        provider: method,
        checkoutUrl: null,
        configured: true,
        message: `${method === 'apple_pay' ? 'Apple Pay' : 'Google Pay'} via RevenueCat (${REVENUECAT_PREMIUM_ENTITLEMENT_PLACEHOLDER} / ${REVENUECAT_PREMIUM_PACKAGE_PLACEHOLDER}, ${quote.priceLabel}) : clé publique OK — nécessite Dev Client + react-native-purchases (pas de succès simulé Expo Go).`,
      };
    }
    return {
      ok: false,
      provider: method,
      checkoutUrl: null,
      configured: false,
      message: `${method === 'apple_pay' ? 'Apple Pay' : 'Google Pay'} : Stripe Checkout base ou RevenueCat requis. Aucun succès fictif.`,
    };
  }

  return {
    ok: false,
    provider: 'none',
    checkoutUrl: null,
    configured: false,
    message: 'Méthode de paiement inconnue.',
  };
}

export async function startSubscriptionCheckout(
  planId: PlanId,
  method: PaymentMethod = 'stripe_card',
  priceOpts?: CheckoutPriceOpts,
): Promise<PaymentAttempt> {
  return startCheckout(planId, method, priceOpts);
}
