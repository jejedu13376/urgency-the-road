import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatSosAlertMessage,
  isValidSosEmail,
  normalizeSosEmail,
  type SosAlertPayload,
} from './sosEmail';

describe('sosEmail', () => {
  it('normalizes and validates basic emails', () => {
    assert.equal(normalizeSosEmail('  Alex@Example.COM '), 'alex@example.com');
    assert.equal(isValidSosEmail('alex@example.com'), true);
    assert.equal(isValidSosEmail('  Alex@Example.COM '), true);
    assert.equal(isValidSosEmail(''), false);
    assert.equal(isValidSosEmail('not-an-email'), false);
    assert.equal(isValidSosEmail('a@b'), false);
    assert.equal(isValidSosEmail('@x.com'), false);
  });

  it('formats SOS alert payload with email', () => {
    const payload: SosAlertPayload = {
      kind: 'sos_alert',
      email: 'alex@example.com',
      lat: 48.85,
      lon: 2.35,
      accuracyM: 12,
      scanCode: 'UM-QR-TEST',
      suggestedEmergency: '112',
      createdAt: '2026-11-23T18:00:00.000Z',
    };
    const msg = formatSosAlertMessage(payload);
    assert.match(msg, /Email contact : alex@example.com/);
    assert.match(msg, /GPS appareil : 48.85, 2.35 · ±12 m/);
    assert.match(msg, /Code QR : UM-QR-TEST/);
    assert.match(msg, /N° urgence suggéré : 112/);
  });
});
