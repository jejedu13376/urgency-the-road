import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOsrmCoordinates } from './osrmRoute';
import { isValhallaMaxDistanceError, VALHALLA_MAX_DISTANCE_M } from './valhallaRoute';

describe('OSRM + Valhalla long-haul helpers', () => {
  it('builds lon,lat;lon,lat path (OSRM axis order)', () => {
    const path = buildOsrmCoordinates(
      { lat: 45.5, lon: -73.57 },
      { lat: 25.76, lon: -80.19 },
      [{ lat: 40.7, lon: -74.0 }],
    );
    assert.equal(path, '-73.57,45.5;-74,40.7;-80.19,25.76');
  });

  it('detects Valhalla max-distance errors', () => {
    assert.equal(VALHALLA_MAX_DISTANCE_M, 1_500_000);
    assert.equal(
      isValhallaMaxDistanceError(
        'Path distance exceeds the max distance limit: 1500000 meters',
      ),
      true,
    );
    assert.equal(isValhallaMaxDistanceError('NoPath'), false);
  });
});
