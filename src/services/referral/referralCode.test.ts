import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  REFERRER_DISCOUNT_MONTHS,
  REFERRER_DISCOUNT_PRICE_MONTHLY_USD,
  PREMIUM_PRICE_MONTHLY_USD,
  addMonthsIso,
  isReferrerDiscountWindowActive,
  resolvePremiumPriceQuote,
} from '../../constants/subscription';
import {
  buildReferralLink,
  generateReferralCode,
  isValidReferralCodeShape,
  normalizeReferralCode,
  parseReferralCodeFromUrl,
} from './referralCode';

describe('referralCode', () => {
  it('generates dyslexia-safe random codes (not uid-predictable)', () => {
    const a = generateReferralCode('user-abc');
    const b = generateReferralCode('user-abc');
    // Random — may collide rarely; shape is what we assert.
    assert.match(a, /^UR[A-Z2-9]{6}$/);
    assert.match(b, /^UR[A-Z2-9]{6}$/);
    assert.equal(isValidReferralCodeShape(a), true);
    assert.equal(/[01IO]/.test(a), false);
  });

  it('parses ref from install URL', () => {
    assert.equal(parseReferralCodeFromUrl('https://app.example/install?ref=URABCD12'), 'URABCD12');
    assert.equal(parseReferralCodeFromUrl('https://app.example/ref/urabcd12'), 'URABCD12');
  });

  it('builds share link with ref param', () => {
    const link = buildReferralLink('https://app.example/install', 'urabcd12');
    assert.ok(link.includes('ref=URABCD12'));
  });

  it('normalizes codes', () => {
    assert.equal(normalizeReferralCode(' ur-ab cd '), 'URABCD');
  });
});

describe('referrer discount pricing', () => {
  it('keeps standard $15 when no window', () => {
    const q = resolvePremiumPriceQuote({});
    assert.equal(q.amountUsdMonthly, PREMIUM_PRICE_MONTHLY_USD);
    assert.equal(q.referrerDiscountActive, false);
  });

  it('applies $12 only inside the 3-month referrer window (display quote)', () => {
    const start = '2026-01-15T12:00:00.000Z';
    const ends = addMonthsIso(start, REFERRER_DISCOUNT_MONTHS);
    const mid = new Date('2026-02-15T12:00:00.000Z');
    const after = new Date('2026-05-01T12:00:00.000Z');
    assert.equal(REFERRER_DISCOUNT_MONTHS, 3);
    assert.equal(REFERRER_DISCOUNT_PRICE_MONTHLY_USD, 12);
    assert.equal(isReferrerDiscountWindowActive(ends, mid), true);
    assert.equal(isReferrerDiscountWindowActive(ends, after), false);
    const active = resolvePremiumPriceQuote({ referrerDiscountEndsAt: ends, now: mid });
    assert.equal(active.amountUsdMonthly, 12);
    assert.equal(active.referrerDiscountActive, true);
    const expired = resolvePremiumPriceQuote({ referrerDiscountEndsAt: ends, now: after });
    assert.equal(expired.amountUsdMonthly, 15);
  });

  it('never discounts merely for being referred (no endsAt)', () => {
    const q = resolvePremiumPriceQuote({ referrerDiscountEndsAt: null });
    assert.equal(q.amountUsdMonthly, 15);
  });
});
