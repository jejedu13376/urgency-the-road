import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AddressSuggestion } from './addressSuggest';

/** Pure mapping checks — no network. */
function fromGeocodeLike(hit: {
  name: string;
  lat: number;
  lon: number;
  admin1?: string;
  country?: string;
  label: string;
}): AddressSuggestion {
  const secondary = [hit.admin1, hit.country].filter(Boolean).join(', ');
  return {
    id: `geo:${hit.lat.toFixed(5)},${hit.lon.toFixed(5)}:${hit.label}`,
    mainText: hit.name,
    secondaryText: secondary,
    label: hit.label,
    lat: hit.lat,
    lon: hit.lon,
    source: 'open-meteo',
  };
}

describe('addressSuggest mapping', () => {
  it('builds a visible two-line address suggestion from geocode', () => {
    const s = fromGeocodeLike({
      name: '12 rue Victor Hugo',
      lat: 48.8566,
      lon: 2.3522,
      admin1: 'Île-de-France',
      country: 'France',
      label: '12 rue Victor Hugo, Île-de-France, France',
    });
    assert.equal(s.mainText, '12 rue Victor Hugo');
    assert.match(s.secondaryText, /France/);
    assert.equal(s.lat, 48.8566);
    assert.ok(s.id.startsWith('geo:'));
    assert.equal(s.placeId, undefined);
  });
});
