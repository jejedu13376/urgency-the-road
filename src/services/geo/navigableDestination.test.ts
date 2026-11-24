import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EXPECTED_REGION_IDS,
  reportNavigableCoverage,
  resolveNavigableDestination,
} from './navigableDestination';

describe('resolveNavigableDestination', () => {
  it('remaps British Columbia wilderness centroid to Vancouver', () => {
    const r = resolveNavigableDestination(55.001251, -125.002441, 'Colombie-Britannique, Canada');
    assert.equal(r.remapped, true);
    assert.ok(Math.abs(r.lat - 49.2827) < 0.01);
    assert.ok(Math.abs(r.lon - -123.1207) < 0.01);
    assert.match(r.label, /Vancouver/i);
  });

  it('remaps Florida / Floride to Miami', () => {
    const en = resolveNavigableDestination(27.6648, -81.5158, 'Florida, United States');
    assert.equal(en.remapped, true);
    assert.ok(Math.abs(en.lat - 25.7617) < 0.01);
    const fr = resolveNavigableDestination(27.6648, -81.5158, 'Floride, États-Unis');
    assert.equal(fr.remapped, true);
    assert.ok(Math.abs(fr.lat - 25.7617) < 0.01);
  });

  it('keeps Miami city coords (already navigable)', () => {
    const r = resolveNavigableDestination(25.77427, -80.19366, 'Miami, Floride, États-Unis');
    assert.equal(r.remapped, false);
    assert.ok(Math.abs(r.lat - 25.77427) < 0.001);
  });

  it('remaps NSW / Australia to Sydney', () => {
    const nsw = resolveNavigableDestination(-32, 147, 'New South Wales, Australia');
    assert.equal(nsw.remapped, true);
    assert.ok(Math.abs(nsw.lat - -33.8688) < 0.01);
    const au = resolveNavigableDestination(-25, 135, 'Australie');
    assert.equal(au.remapped, true);
    assert.ok(Math.abs(au.lat - -33.8688) < 0.01);
  });

  it('remaps European country picks to capitals', () => {
    const fr = resolveNavigableDestination(46.2, 2.2, 'France');
    assert.equal(fr.remapped, true);
    assert.ok(Math.abs(fr.lat - 48.8566) < 0.01);
    const de = resolveNavigableDestination(51.1, 10.4, 'Allemagne');
    assert.equal(de.remapped, true);
    assert.ok(Math.abs(de.lat - 52.52) < 0.01);
    const al = resolveNavigableDestination(40.5, 20.5, 'Albania');
    assert.equal(al.remapped, true);
    assert.ok(Math.abs(al.lat - 41.3275) < 0.01);
    const sco = resolveNavigableDestination(57.2, -4.5, 'Scotland');
    assert.equal(sco.remapped, true);
    assert.match(sco.label, /Edinburgh/i);
  });

  it('remaps every US state name sample (WY, AK, HI)', () => {
    const wy = resolveNavigableDestination(43, -107, 'Wyoming, United States');
    assert.equal(wy.remapped, true);
    assert.match(wy.label, /Cheyenne/i);
    const ak = resolveNavigableDestination(64, -153, 'Alaska');
    assert.equal(ak.remapped, true);
    assert.match(ak.label, /Anchorage/i);
    const hi = resolveNavigableDestination(20.5, -156.5, 'Hawaii');
    assert.equal(hi.remapped, true);
    assert.match(hi.label, /Honolulu/i);
  });

  it('does not remap a street / unknown place', () => {
    const r = resolveNavigableDestination(45.5017, -73.5673, 'Rue Sainte-Catherine, Montréal');
    assert.equal(r.remapped, false);
    assert.equal(r.lat, 45.5017);
  });

  it('does not remap a city that merely lists its state', () => {
    const orlando = resolveNavigableDestination(28.5383, -81.3792, 'Orlando, Florida, USA');
    assert.equal(orlando.remapped, false);
    assert.equal(orlando.lat, 28.5383);
    const miami = resolveNavigableDestination(25.77427, -80.19366, 'Miami, Florida, USA');
    assert.equal(miami.remapped, false);
  });

  it('covers all expected CA / US / AU / EU region ids (none missing)', () => {
    const reports = reportNavigableCoverage();
    for (const r of reports) {
      assert.equal(
        r.missingIds.length,
        0,
        `${r.scope} missing: ${r.missingIds.join(', ')}`,
      );
      assert.equal(r.coveredIds.length, r.expected);
      assert.equal(r.expected, EXPECTED_REGION_IDS[r.scope].length);
    }
    const byScope = Object.fromEntries(reports.map((r) => [r.scope, r.expected]));
    assert.equal(byScope.US, 52); // 50 states + DC + country
    assert.equal(byScope.AU, 9); // 8 + country
    assert.equal(byScope.CA, 14); // 13 + country
    assert.ok(byScope.EU >= 50, `EU expected >= 50, got ${byScope.EU}`);
  });
});
