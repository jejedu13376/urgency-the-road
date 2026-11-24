import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attestCarnet, buildCanonicalCarnet, digestCarnetPayload } from './carnetAttestation';

describe('carnetAttestation', () => {
  const base = {
    vehicleLabel: 'Ford F-150',
    vin: '1FTFW1E50MFA00001',
    odometerKm: 120000,
    entries: [
      { title: 'Vidange', km: 118000, dateIso: '2026-01-10', cost: 89, currency: 'CAD' },
    ],
    maintenanceDone: ['Vidange'],
    exportedAtIso: '2026-11-24T01:00:00.000Z',
  };

  it('is deterministic for same payload', () => {
    const a = attestCarnet(base);
    const b = attestCarnet(base);
    assert.equal(a.hash, b.hash);
    assert.equal(a.hash.length, 64);
    assert.match(a.label, /Attestation locale/);
  });

  it('changes when an entry changes', () => {
    const a = attestCarnet(base);
    const b = attestCarnet({
      ...base,
      entries: [{ ...base.entries[0], cost: 99 }],
    });
    assert.notEqual(a.hash, b.hash);
  });

  it('canonical includes VIN uppercase', () => {
    const c = buildCanonicalCarnet({ ...base, vin: 'aftfw1e50mfa00001' });
    assert.match(c, /AFTFW1E50MFA00001/);
  });

  it('digest is stable hex', () => {
    const h = digestCarnetPayload('hello');
    assert.equal(h, digestCarnetPayload('hello'));
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it('covers late entries (same length edit at end changes hash)', () => {
    const longPrefix = 'x'.repeat(200);
    const a = digestCarnetPayload(`${longPrefix}ENTRY-AAA`);
    const b = digestCarnetPayload(`${longPrefix}ENTRY-BBB`);
    assert.notEqual(a, b);
  });
});
