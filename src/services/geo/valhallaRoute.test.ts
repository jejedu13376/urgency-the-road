import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildValhallaPayload,
  normalizeTruckCosting,
  relaxedTruckCosting,
} from './valhallaRoute';

describe('valhalla truck costing', () => {
  it('uses costing truck (never Truck/lorry) with normalized dims', () => {
    const payload = buildValhallaPayload(
      { lat: 48.85, lon: 2.35 },
      { lat: 45.76, lon: 4.83 },
      'camion',
      { heightM: 4, widthM: 2.55, weightT: 40 },
    );
    assert.equal(payload.costing, 'truck');
    const opts = payload.costing_options as { truck: Record<string, number> };
    assert.ok(opts.truck);
    assert.equal(opts.truck.height, 4);
    assert.equal(opts.truck.width, 2.55);
    assert.ok(opts.truck.weight <= 44);
    assert.ok(opts.truck.length > 0);
    assert.equal(payload.units, 'kilometers');
  });

  it('auto mode has no truck costing_options', () => {
    const payload = buildValhallaPayload(
      { lat: 48.85, lon: 2.35 },
      { lat: 48.87, lon: 2.3 },
      'voiture',
    );
    assert.equal(payload.costing, 'auto');
    assert.equal(payload.costing_options, undefined);
  });

  it('relaxed truck stays truck and lowers weight/height', () => {
    const strict = normalizeTruckCosting({ heightM: 4.5, weightT: 40 });
    const soft = relaxedTruckCosting({ heightM: 4.5, weightT: 40 });
    assert.ok(Number(soft.height) <= Number(strict.height));
    assert.ok(Number(soft.weight) <= Number(strict.weight));
    const payload = buildValhallaPayload(
      { lat: 50.63, lon: 3.06 },
      { lat: 50.64, lon: 3.07 },
      'camion',
      { heightM: 4.5, weightT: 40 },
      { relaxed: true },
    );
    assert.equal(payload.costing, 'truck');
  });

  it('passes exclude_locations for incident detours', () => {
    const payload = buildValhallaPayload(
      { lat: 48.85, lon: 2.35 },
      { lat: 48.87, lon: 2.3 },
      'auto',
      undefined,
      { excludeLocations: [{ lat: 48.86, lon: 2.34 }] },
    );
    const ex = payload.exclude_locations as { lat: number; lon: number }[];
    assert.equal(ex.length, 1);
    assert.equal(ex[0].lat, 48.86);
  });

  it('omits exclude_locations when cleared for retry', () => {
    const payload = buildValhallaPayload(
      { lat: 48.85, lon: 2.35 },
      { lat: 48.87, lon: 2.3 },
      'camion',
      { heightM: 4 },
      { excludeLocations: undefined, relaxed: true },
    );
    assert.equal(payload.exclude_locations, undefined);
    assert.equal(payload.costing, 'truck');
  });
});
