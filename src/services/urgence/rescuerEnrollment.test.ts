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

  it('applyRescuerOverlay refuses elevation without DEV soft-auth', () => {
    // NODE test runs without EXPO_PUBLIC_DEV_SOFT_AUTH / __DEV__ → no overlay.
    const soft = {
      ...defaultEnrollment('u1'),
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
    assert.equal(over?.role, 'user');
    assert.equal(over?.subscriptionActive, false);
  });

  it('applyRescuerOverlay ignores mismatched uid even if soft status set', () => {
    const other = {
      ...defaultEnrollment('u-other'),
      badgeId: 'SP-99',
      status: 'soft_active' as const,
      checklist: {
        id_pro: true,
        org_attestation: true,
        phi_training: true,
        tos_secours: true,
      },
    };
    assert.equal(applyRescuerOverlay(baseUser, other)?.role, 'user');
  });
});
