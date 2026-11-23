import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { advisoryFromOpeningHours } from './openingHours';

describe('advisoryFromOpeningHours', () => {
  it('empty / missing → unknown', () => {
    const a = advisoryFromOpeningHours(undefined);
    assert.equal(a.status, 'unknown');
    assert.equal(a.litUp, false);
    assert.match(a.note, /UNKNOWN/);

    const b = advisoryFromOpeningHours('   ');
    assert.equal(b.status, 'unknown');
  });

  it('24/7 → open', () => {
    const a = advisoryFromOpeningHours('24/7');
    assert.equal(a.status, 'open');
    assert.equal(a.litUp, true);
  });

  it('closed → closed', () => {
    const a = advisoryFromOpeningHours('closed');
    assert.equal(a.status, 'closed');
    assert.equal(a.litUp, false);
  });

  it('Mo-Fr window open/closed by clock', () => {
    // Wednesday 2026-11-25 10:00 local
    const wedOpen = new Date(2026, 10, 25, 10, 0, 0);
    const open = advisoryFromOpeningHours('Mo-Fr 08:00-18:00', wedOpen);
    assert.equal(open.status, 'open');
    assert.equal(open.litUp, true);

    const wedClosed = new Date(2026, 10, 25, 19, 0, 0);
    const closed = advisoryFromOpeningHours('Mo-Fr 08:00-18:00', wedClosed);
    assert.equal(closed.status, 'closed');

    // Sunday outside day range
    const sun = new Date(2026, 10, 22, 10, 0, 0);
    const weekend = advisoryFromOpeningHours('Mo-Fr 08:00-18:00', sun);
    assert.equal(weekend.status, 'closed');
  });

  it('complex / mixed rules → unknown (no false always-open)', () => {
    const a = advisoryFromOpeningHours('Mo-Fr 08:00-18:00; Sa 09:00-12:00');
    assert.equal(a.status, 'unknown');
    const b = advisoryFromOpeningHours('24/7; PH off');
    assert.equal(b.status, 'unknown');
  });
});
