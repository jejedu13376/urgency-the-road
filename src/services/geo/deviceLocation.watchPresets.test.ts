import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GPS_WATCH_MAP_IDLE,
  GPS_WATCH_NAVIGATING,
  GPS_WATCH_SAFETY,
  GPS_WATCH_SAFETY_DELTA_CAP_SEC,
} from './gpsWatchPresets';

/** Same floor as drivingBreak.DRIVING_SPEED_MIN_MPS — keep test free of expo deps. */
const DRIVING_SPEED_MIN_MPS = 2;

describe('GPS watch presets', () => {
  it('keeps navigating denser than idle map follow', () => {
    assert.ok(GPS_WATCH_NAVIGATING.timeInterval < GPS_WATCH_MAP_IDLE.timeInterval);
    assert.ok(GPS_WATCH_NAVIGATING.distanceInterval < GPS_WATCH_MAP_IDLE.distanceInterval);
    assert.equal(GPS_WATCH_NAVIGATING.accuracy, 4);
    assert.equal(GPS_WATCH_MAP_IDLE.accuracy, 3);
  });

  it('keeps HOS/safety from undercounting at min driving speed', () => {
    const gapSec = GPS_WATCH_SAFETY.distanceInterval / DRIVING_SPEED_MIN_MPS;
    assert.ok(
      gapSec <= GPS_WATCH_SAFETY_DELTA_CAP_SEC,
      `distanceInterval/minSpeed (${gapSec}s) must fit in delta cap (${GPS_WATCH_SAFETY_DELTA_CAP_SEC}s)`,
    );
    assert.ok(GPS_WATCH_SAFETY.timeInterval >= GPS_WATCH_MAP_IDLE.timeInterval);
  });
});
