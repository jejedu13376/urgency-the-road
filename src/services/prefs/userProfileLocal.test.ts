import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isValidEmail,
  isValidPhone,
  mergeAutofill,
  validatePassword,
  type LocalUserProfile,
} from './userProfileLocal';

describe('userProfileLocal validation', () => {
  it('accepts basic emails', () => {
    assert.equal(isValidEmail('demo@urgence-mecanique.com'), true);
    assert.equal(isValidEmail('bad'), false);
    assert.equal(isValidEmail(''), false);
  });

  it('enforces cahier password rules', () => {
    assert.equal(validatePassword('Abcdef!').ok, true);
    assert.equal(validatePassword('abcdef!').ok, false);
    assert.equal(validatePassword('Abcdef').ok, false);
    assert.equal(validatePassword('Ab!').ok, false);
  });

  it('treats empty phone as optional ok', () => {
    assert.equal(isValidPhone(''), true);
    assert.equal(isValidPhone('+33612345678'), true);
    assert.equal(isValidPhone('12'), false);
  });

  it('prefers auth email for autofill', () => {
    const local: LocalUserProfile = {
      email: 'old@local.test',
      displayName: 'Local',
      phone: '0600000000',
      city: 'Lille',
      lastEmail: 'old@local.test',
      updatedAt: '',
    };
    const merged = mergeAutofill(local, { email: 'live@auth.test', displayName: 'Live' });
    assert.equal(merged.email, 'live@auth.test');
    assert.equal(merged.displayName, 'Live');
  });
});
