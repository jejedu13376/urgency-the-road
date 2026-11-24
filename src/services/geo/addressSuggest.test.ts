import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AddressSuggestion } from './addressSuggest';

/** Pure mapping checks — no network. */
/** Mirrors addressSuggest.fromGeocode secondary-line rules (no network). */
function secondaryFromGeocode(hit: {
  name: string;
  city?: string;
  admin1?: string;
  country?: string;
  label: string;
}): string {
  const city =
    hit.city && hit.city.trim().toLowerCase() !== hit.name.trim().toLowerCase()
      ? hit.city.trim()
      : undefined;
  const secondaryParts = [city, hit.admin1, hit.country].filter(Boolean) as string[];
  let secondary = secondaryParts.join(', ');
  if (!city && hit.label) {
    const prefix = `${hit.name}, `;
    if (hit.label.startsWith(prefix) && hit.label.length > prefix.length) {
      secondary = hit.label.slice(prefix.length);
    }
  }
  return secondary;
}

describe('addressSuggest mapping', () => {
  it('builds a visible two-line address suggestion from geocode', () => {
    const hit = {
      name: '12 rue Victor Hugo',
      lat: 48.8566,
      lon: 2.3522,
      city: 'Paris',
      admin1: 'Île-de-France',
      country: 'France',
      label: '12 rue Victor Hugo, Paris, Île-de-France, France',
    };
    const secondary = secondaryFromGeocode(hit);
    const s: AddressSuggestion = {
      id: `geo:${hit.lat.toFixed(5)},${hit.lon.toFixed(5)}:${hit.label}`,
      mainText: hit.name,
      secondaryText: secondary,
      label: hit.label,
      lat: hit.lat,
      lon: hit.lon,
      source: 'open-meteo',
    };
    assert.equal(s.mainText, '12 rue Victor Hugo');
    assert.match(s.secondaryText, /Paris/);
    assert.match(s.secondaryText, /France/);
    assert.equal(s.lat, 48.8566);
    assert.ok(s.id.startsWith('geo:'));
    assert.equal(s.placeId, undefined);
  });

  it('recovers city from label when city field is missing', () => {
    const secondary = secondaryFromGeocode({
      name: '12 rue Victor Hugo',
      admin1: 'Île-de-France',
      country: 'France',
      label: '12 rue Victor Hugo, Lyon, Île-de-France, France',
    });
    assert.match(secondary, /Lyon/);
  });
});
