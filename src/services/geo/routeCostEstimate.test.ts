import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateFuelCost, estimateTollCost, formatCad } from './routeCostEstimate';

describe('routeCostEstimate', () => {
  it('estimates fuel from distance when API omits liters', () => {
    const f = estimateFuelCost(100, 'voiture');
    assert.equal(f.source, 'estimate');
    assert.ok(f.liters > 0);
    assert.ok(f.costCad > 0);
  });

  it('uses TomTom liters when provided', () => {
    const f = estimateFuelCost(100, 'voiture', 7.2);
    assert.equal(f.source, 'tomtom');
    assert.equal(f.liters, 7.2);
  });

  it('reports no toll when section km is zero', () => {
    const t = estimateTollCost('voiture', { tollSectionKm: 0 });
    assert.equal(t.source, 'none');
    assert.equal(t.costCad, null);
  });

  it('estimates toll from section km', () => {
    const t = estimateTollCost('voiture', { tollSectionKm: 10 });
    assert.equal(t.source, 'estimate');
    assert.ok((t.costCad ?? 0) > 0);
  });

  it('formats CAD with comma decimal', () => {
    assert.equal(formatCad(12.5), '12,50 $');
  });
});
