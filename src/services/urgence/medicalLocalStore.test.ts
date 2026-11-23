import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isIsoNewer } from './medicalLocalStore';

describe('medicalLocalStore helpers', () => {
  it('isIsoNewer compares timestamps', () => {
    assert.equal(isIsoNewer('2026-11-23T20:00:00.000Z', '2026-11-23T19:00:00.000Z'), true);
    assert.equal(isIsoNewer('2026-11-23T19:00:00.000Z', '2026-11-23T20:00:00.000Z'), false);
    assert.equal(isIsoNewer(undefined, '2026-11-23T19:00:00.000Z'), false);
    assert.equal(isIsoNewer('2026-11-23T20:00:00.000Z', undefined), true);
  });
});
