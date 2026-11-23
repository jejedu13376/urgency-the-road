import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodePolyline6 } from './polyline6';

/** Encode polyline6 for test fixture (mirrors Valhalla precision). */
function encodePolyline6(coords: [number, number][]): string {
  let lastLat = 0;
  let lastLon = 0;
  let result = '';
  const write = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    result += String.fromCharCode(v + 63);
  };
  for (const [lat, lon] of coords) {
    const ilat = Math.round(lat * 1e6);
    const ilon = Math.round(lon * 1e6);
    write(ilat - lastLat);
    write(ilon - lastLon);
    lastLat = ilat;
    lastLon = ilon;
  }
  return result;
}

describe('decodePolyline6', () => {
  it('round-trips Lille → nearby point', () => {
    const original: [number, number][] = [
      [50.6292, 3.0573],
      [50.6365, 3.0708],
    ];
    const encoded = encodePolyline6(original);
    const decoded = decodePolyline6(encoded);
    assert.equal(decoded.length, 2);
    assert.ok(Math.abs(decoded[0][0] - original[0][0]) < 1e-5);
    assert.ok(Math.abs(decoded[0][1] - original[0][1]) < 1e-5);
    assert.ok(Math.abs(decoded[1][0] - original[1][0]) < 1e-5);
    assert.ok(Math.abs(decoded[1][1] - original[1][1]) < 1e-5);
  });
});
