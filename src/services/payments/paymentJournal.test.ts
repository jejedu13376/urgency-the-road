import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PREMIUM_CURRENCY,
  PREMIUM_PLAN_ID,
  PREMIUM_PRICE_MONTHLY_USD,
} from '../../constants/subscription';
import { MOCK_PLANS } from '../../data/mocks';

describe('payments software path', () => {
  it('Premium plan is $15 USD / month (single catalog plan)', () => {
    assert.equal(PREMIUM_PLAN_ID, 'premium');
    assert.equal(PREMIUM_PRICE_MONTHLY_USD, 15);
    assert.equal(PREMIUM_CURRENCY, 'USD');
    assert.equal(MOCK_PLANS.length, 1);
    const premium = MOCK_PLANS[0];
    assert.equal(premium.id, 'premium');
    assert.equal(premium.priceMonthly, 15);
    assert.equal(premium.currency, 'USD');
  });

  it('paymentJournal source exposes LIVE software path', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const journal = readFileSync(join(dir, 'paymentJournal.ts'), 'utf8');
    assert.match(journal, /PAYMENTS_SOFTWARE_LIVE/);
    assert.match(journal, /Premium \$15\/mo/);
  });
});
