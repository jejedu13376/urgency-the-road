/**
 * Payments scaffold — Stripe Checkout URL via EXPO_PUBLIC_STRIPE_CHECKOUT_BASE
 * or RevenueCat via EXPO_PUBLIC_REVENUECAT_API_KEY.
 * Never reports success without real config / URL.
 */
import * as Linking from 'expo-linking';

export type PayPlanId = string;
/** Alias used by Module 15 UI */
export type PlanId = PayPlanId;

export type PaymentAttempt = {
  ok: boolean;
  provider: 'stripe' | 'revenuecat' | 'none';
  checkoutUrl: string | null;
  message: string;
  configured: boolean;
};

function stripeBase(): string {
  return (process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_BASE ?? '').trim().replace(/\/$/, '');
}

function revenueCatKey(): string {
  return (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '').trim();
}

export function isPaymentsConfigured(): boolean {
  return Boolean(stripeBase() || revenueCatKey());
}

export function paymentsStatusLabel(): string {
  if (stripeBase()) return 'Stripe Checkout configuré (URL publique)';
  if (revenueCatKey()) return 'RevenueCat clé publique présente (SDK native à brancher en build custom)';
  return 'Paiements non configurés — EXPO_PUBLIC_STRIPE_CHECKOUT_BASE ou EXPO_PUBLIC_REVENUECAT_API_KEY requis';
}

/** Alias for Module 15 StubBanner */
export function paymentsConfigLabel(): string {
  return paymentsStatusLabel();
}

/**
 * Start checkout for a plan. Opens Stripe URL if base is set.
 * RevenueCat path: documents need for native SDK — does NOT fake purchase.
 */
export async function startCheckout(planId: PayPlanId): Promise<PaymentAttempt> {
  const base = stripeBase();
  if (base) {
    const url = `${base}?plan=${encodeURIComponent(planId)}&utm_source=urgence_mecanique`;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        return {
          ok: false,
          provider: 'stripe',
          checkoutUrl: url,
          configured: true,
          message: `Stripe URL non ouvrable : ${url}`,
        };
      }
      await Linking.openURL(url);
      return {
        ok: true,
        provider: 'stripe',
        checkoutUrl: url,
        configured: true,
        message: `Checkout Stripe ouvert pour le plan « ${planId} ».`,
      };
    } catch (e) {
      return {
        ok: false,
        provider: 'stripe',
        checkoutUrl: url,
        configured: true,
        message: e instanceof Error ? e.message : 'Échec ouverture Stripe',
      };
    }
  }

  if (revenueCatKey()) {
    return {
      ok: false,
      provider: 'revenuecat',
      checkoutUrl: null,
      configured: true,
      message:
        'RevenueCat : clé publique détectée. Achats IAP nécessitent un Dev Client / EAS build avec react-native-purchases — pas de succès simulé dans Expo Go.',
    };
  }

  return {
    ok: false,
    provider: 'none',
    checkoutUrl: null,
    configured: false,
    message:
      'Paiement bloqué : définir EXPO_PUBLIC_STRIPE_CHECKOUT_BASE (URL Checkout) ou EXPO_PUBLIC_REVENUECAT_API_KEY. Aucun succès fictif.',
  };
}

/** Alias for Module 15 checkout CTA */
export async function startSubscriptionCheckout(planId: PlanId): Promise<PaymentAttempt> {
  return startCheckout(planId);
}
