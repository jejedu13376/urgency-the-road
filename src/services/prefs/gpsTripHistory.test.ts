import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTripRouteLine, formatTripSummaryLine, type GpsTripRecord } from './gpsTripHistory';

const sample: GpsTripRecord = {
  id: 'trip-1',
  startedAt: '2026-11-24T12:00:00.000Z',
  endedAt: '2026-11-24T13:30:00.000Z',
  mode: 'voiture',
  origin: { lat: 48.85, lon: 2.35, label: 'Paris' },
  destination: { lat: 45.75, lon: 4.85, label: 'Lyon' },
  distanceKm: 465.2,
  durationMin: 270,
  coords: [
    [48.85, 2.35],
    [45.75, 4.85],
  ],
};

describe('gpsTripHistory Chronologie helpers', () => {
  it('formatTripRouteLine is origin → destination', () => {
    assert.equal(formatTripRouteLine(sample), 'Paris → Lyon');
  });

  it('formatTripSummaryLine keeps distance meta', () => {
    assert.match(formatTripSummaryLine(sample), /Paris → Lyon/);
    assert.match(formatTripSummaryLine(sample), /465\.2 km/);
  });
});
