import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyRescuerOverlay,
  checklistComplete,
  defaultEnrollment,
  SECOURS_PRODUCT_LIVE,
} from './rescuerEnrollment';
import type { UserDoc } from '../../types/firestore';

const baseUser: UserDoc = {
  uid: 'u1',
  email: 'a@b.c',
  role: 'user',
  subscription: 'free',
  subscriptionActive: false,
  locale: 'fr',
  currency: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('rescuerEnrollment', () => {
  it('exposes product LIVE label', () => {
    assert.match(SECOURS_PRODUCT_LIVE, /Auth secours produit LIVE/);
  });

  it('checklistComplete requires all boxes', () => {
    const e = defaultEnrollment('u1');
    assert.equal(checklistComplete(e), false);
    e.checklist = {
      id_pro: true,
      org_attestation: true,
      phi_training: true,
      tos_secours: true,
    };
    assert.equal(checklistComplete(e), true);
  });

  it('applyRescuerOverlay elevates soft_active only', () => {
    const draft = defaultEnrollment('u1');
    assert.equal(applyRescuerOverlay(baseUser, draft)?.role, 'user');

    const soft = {
      ...draft,
      badgeId: 'SP-59-4421',
      status: 'soft_active' as const,
      checklist: {
        id_pro: true,
        org_attestation: true,
        phi_training: true,
        tos_secours: true,
      },
    };
    const over = applyRescuerOverlay(baseUser, soft);
    assert.equal(over?.role, 'rescuer');
    assert.equal(over?.subscription, 'rescuer');
    assert.equal(over?.subscriptionActive, true);
    assert.equal(over?.rescuerBadgeId, 'SP-59-4421');
  });
});
