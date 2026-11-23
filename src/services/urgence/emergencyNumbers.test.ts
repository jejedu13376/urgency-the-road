import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMERGENCY_NUMBERS,
  coarseRegionFromCountryCode,
  coarseRegionFromLatLon,
  suggestEmergencyNumberId,
} from './emergencyNumbers';

describe('emergencyNumbers', () => {
  it('lists all four regional options including universal 112', () => {
    assert.equal(EMERGENCY_NUMBERS.length, 4);
    const ids = EMERGENCY_NUMBERS.map((o) => o.id);
    assert.deepEqual(ids, ['universal', 'europe', 'australia', 'north_america']);
    assert.equal(EMERGENCY_NUMBERS.find((o) => o.id === 'universal')?.number, '112');
    assert.equal(EMERGENCY_NUMBERS.find((o) => o.id === 'europe')?.number, '112');
    assert.equal(EMERGENCY_NUMBERS.find((o) => o.id === 'australia')?.number, '000');
    assert.equal(EMERGENCY_NUMBERS.find((o) => o.id === 'north_america')?.number, '911');
  });

  it('maps country codes to coarse regions', () => {
    assert.equal(coarseRegionFromCountryCode('US'), 'NA');
    assert.equal(coarseRegionFromCountryCode('ca'), 'NA');
    assert.equal(coarseRegionFromCountryCode('AU'), 'AU');
    assert.equal(coarseRegionFromCountryCode('FR'), 'EU');
    assert.equal(coarseRegionFromCountryCode(null), null);
  });

  it('maps lat/lon heuristics', () => {
    assert.equal(coarseRegionFromLatLon(40.7, -74), 'NA');
    assert.equal(coarseRegionFromLatLon(-33.8, 151.2), 'AU');
    assert.equal(coarseRegionFromLatLon(48.8, 2.3), 'EU');
  });

  it('suggests from GPS over regionCode', () => {
    assert.equal(
      suggestEmergencyNumberId({ lat: 40.7, lon: -74, regionCode: 'FR' }),
      'north_america',
    );
    assert.equal(suggestEmergencyNumberId({ regionCode: 'AU' }), 'australia');
    assert.equal(suggestEmergencyNumberId({ regionCode: 'DE' }), 'europe');
  });
});
