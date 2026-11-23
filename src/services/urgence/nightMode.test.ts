import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAutoNightHour, resolveNightActive } from './nightMode';

describe('nightMode', () => {
  it('auto is night from 19:00 to 05:59', () => {
    assert.equal(isAutoNightHour(19), true);
    assert.equal(isAutoNightHour(23), true);
    assert.equal(isAutoNightHour(5), true);
    assert.equal(isAutoNightHour(6), false);
    assert.equal(isAutoNightHour(12), false);
  });

  it('manual on/off overrides auto', () => {
    assert.equal(resolveNightActive({ setting: 'on', hour: 12 }), true);
    assert.equal(resolveNightActive({ setting: 'off', hour: 22 }), false);
    assert.equal(resolveNightActive({ setting: 'auto', hour: 22 }), true);
  });
});
