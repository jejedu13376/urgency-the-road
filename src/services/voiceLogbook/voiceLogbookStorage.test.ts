import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDurationMs } from './formatDuration';

describe('formatDurationMs', () => {
  it('formats zero and seconds', () => {
    assert.equal(formatDurationMs(0), '0:00');
    assert.equal(formatDurationMs(900), '0:01');
    assert.equal(formatDurationMs(65_000), '1:05');
  });
});
