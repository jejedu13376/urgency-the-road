import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeHosLiveStatus } from './hosLive';
import {
  evaluateHosCompliance,
  hosRegionFromCountryCode,
  hosRegionFromLatLon,
  resolveHosRegion,
} from './hosRegs';

describe('hosRegs', () => {
  it('maps country codes to CA/US/EU/AU', () => {
    assert.equal(hosRegionFromCountryCode('CA'), 'CA');
    assert.equal(hosRegionFromCountryCode('US'), 'US');
    assert.equal(hosRegionFromCountryCode('FR'), 'EU');
    assert.equal(hosRegionFromCountryCode('AU'), 'AU');
  });

  it('GPS NA split uses 49th parallel heuristic', () => {
    assert.equal(hosRegionFromLatLon(51.05, -114.07), 'CA');
    assert.equal(hosRegionFromLatLon(40.7, -74.0), 'US');
    assert.equal(hosRegionFromLatLon(-33.8, 151.2), 'AU');
    assert.equal(hosRegionFromLatLon(48.8, 2.3), 'EU');
  });

  it('explicit selection wins over GPS', () => {
    assert.equal(
      resolveHosRegion({ explicit: 'EU', lat: 51, lon: -114, countryCode: 'CA' }),
      'EU',
    );
  });

  it('warns near and flags over regional limits', () => {
    const near = evaluateHosCompliance({
      region: 'EU',
      drivingSec: 9 * 3600 * 0.9,
      sinceBreakSec: 4.5 * 3600 * 0.9,
    });
    assert.equal(near.nearLimit, true);
    assert.equal(near.overLimit, false);

    const over = evaluateHosCompliance({
      region: 'US',
      drivingSec: 11 * 3600,
      sinceBreakSec: 8 * 3600,
    });
    assert.equal(over.overLimit, true);
  });
});

describe('hosLive', () => {
  it('shows hours left and next mandatory stop per country', () => {
    const now = new Date('2026-11-23T12:00:00');
    const eu = computeHosLiveStatus({
      region: 'EU',
      drivingSec: 2 * 3600,
      sinceBreakSec: 2 * 3600,
      now,
    });
    // 9h max − 2h = 7h left; break after 4.5h → 2.5h until break (sooner)
    assert.equal(eu.hoursLeftSec, 7 * 3600);
    assert.ok(eu.nextMandatoryStopInSec === 2.5 * 3600);
    assert.ok(eu.nextMandatoryStopLabel.includes('Break by'));

    const us = computeHosLiveStatus({
      region: 'US',
      drivingSec: 10 * 3600,
      sinceBreakSec: 7 * 3600,
      now,
    });
    assert.equal(us.hoursLeftSec, 3600);
    assert.ok(us.nextMandatoryStopInSec === 3600); // min(1h left, 1h to break)

    const ca = computeHosLiveStatus({
      region: 'CA',
      drivingSec: 13 * 3600,
      sinceBreakSec: 1,
      now,
    });
    assert.equal(ca.hoursLeftSec, 0);
    assert.ok(ca.nextMandatoryStopLabel.includes('STOP now'));

    const au = computeHosLiveStatus({
      region: 'AU',
      drivingSec: 0,
      sinceBreakSec: 0,
      now,
    });
    assert.equal(au.hoursLeftSec, 12 * 3600);
    assert.equal(au.region, 'AU');
  });
});
