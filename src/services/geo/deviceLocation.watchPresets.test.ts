import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GPS_WATCH_MAP_IDLE,
  GPS_WATCH_NAVIGATING,
  GPS_WATCH_SAFETY,
} from './gpsWatchPresets';

describe('GPS watch presets', () => {
  it('keeps navigating denser than idle map follow', () => {
    assert.ok(GPS_WATCH_NAVIGATING.timeInterval < GPS_WATCH_MAP_IDLE.timeInterval);
    assert.ok(GPS_WATCH_NAVIGATING.distanceInterval < GPS_WATCH_MAP_IDLE.distanceInterval);
    assert.equal(GPS_WATCH_NAVIGATING.accuracy, 4);
    assert.equal(GPS_WATCH_MAP_IDLE.accuracy, 3);
  });

  it('keeps HOS/safety coarser than map idle', () => {
    assert.ok(GPS_WATCH_SAFETY.timeInterval >= GPS_WATCH_MAP_IDLE.timeInterval);
    assert.ok(GPS_WATCH_SAFETY.distanceInterval > GPS_WATCH_MAP_IDLE.distanceInterval);
  });
});
