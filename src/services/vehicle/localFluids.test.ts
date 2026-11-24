import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateLocalFluids } from './localFluids';

describe('estimateLocalFluids', () => {
  it('estimates PL oil from displacement', () => {
    const r = estimateLocalFluids({
      vehicleClass: 'poids_lourd',
      powertrain: 'poids_lourd_diesel',
      displacementL: 12.8,
    });
    assert.equal(r.source, 'local_estimate');
    assert.ok(r.fluids.engineOilL >= 22);
    assert.match(r.label, /PL/);
  });

  it('EV has no engine oil and omits fuel', () => {
    const r = estimateLocalFluids({
      vehicleClass: 'voiture',
      powertrain: 'electrique',
    });
    assert.equal(r.fluids.engineOilL, 0);
    assert.equal(r.fluids.fuelL, undefined);
  });

  it('make-aware oil for known ICE brands', () => {
    const generic = estimateLocalFluids({
      vehicleClass: 'voiture',
      powertrain: 'essence',
      displacementL: 2.0,
    });
    const ford = estimateLocalFluids({
      vehicleClass: 'voiture',
      powertrain: 'essence',
      displacementL: 2.0,
      make: 'Ford',
    });
    assert.notEqual(ford.fluids.engineOilL, generic.fluids.engineOilL);
    assert.match(ford.label, /Ford|marque/i);
  });

  it('pickup scales with displacement', () => {
    const r = estimateLocalFluids({
      vehicleClass: 'pickup',
      powertrain: 'essence',
      displacementL: 5.0,
    });
    assert.ok(r.fluids.engineOilL >= 5.5);
    assert.ok((r.fluids.fuelL ?? 0) >= 80);
  });
});
