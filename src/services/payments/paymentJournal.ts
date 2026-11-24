/**
 * Module 15 — local journal of checkout attempts (no fake paid success).
 * Software path records opens / refusals; Stripe/PayPal/RC keys remain ops.
 * Premium catalog price lives in src/constants/subscription.ts ($15/mo).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PREMIUM_PLAN_ID,
  PREMIUM_PRICE_MONTHLY_USD,
} from '../../constants/subscription';
import type { PaymentAttempt, PaymentMethod } from './paymentsService';

const KEY = 'um.payments.journal.v1';
const MAX = 40;

export type PaymentJournalEntry = {
  id: string;
  planId: string;
  method: PaymentMethod | 'none';
  ok: boolean;
  configured: boolean;
  checkoutUrl: string | null;
  message: string;
  at: string;
};

export async function loadPaymentJournal(): Promise<PaymentJournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaymentJournalEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export async function recordPaymentAttempt(
  planId: string,
  attempt: PaymentAttempt,
): Promise<PaymentJournalEntry[]> {
  const entry: PaymentJournalEntry = {
    id: `pay-${Date.now()}`,
    planId,
    method: attempt.provider,
    ok: attempt.ok,
    configured: attempt.configured,
    checkoutUrl: attempt.checkoutUrl,
    message: attempt.message,
    at: new Date().toISOString(),
  };
  const prev = await loadPaymentJournal();
  const next = [entry, ...prev].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export const PAYMENTS_SOFTWARE_LIVE =
  'Paiements chemin logiciel LIVE — Premium $15/mo · Checkout / journal local ; clés Stripe·PayPal·RC = ops externes.';

export { PREMIUM_PLAN_ID, PREMIUM_PRICE_MONTHLY_USD };
/** @deprecated Prefer PREMIUM_PRICE_MONTHLY_USD from constants/subscription. */
export const PREMIUM_PRICE_USD_MONTHLY = PREMIUM_PRICE_MONTHLY_USD;
