import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fetchWeatherAlongRoute,
  precipKindFromWmo,
  sampleRouteWeatherPoints,
  worsePrecip,
  type WeatherSnapshot,
} from './openMeteo';

describe('openMeteo precip + route sampling', () => {
  it('maps WMO codes to rain / snow / ice / storm', () => {
    assert.equal(precipKindFromWmo(0), 'none');
    assert.equal(precipKindFromWmo(61), 'rain');
    assert.equal(precipKindFromWmo(71), 'snow');
    assert.equal(precipKindFromWmo(66), 'ice');
    assert.equal(precipKindFromWmo(95), 'storm');
    assert.equal(precipKindFromWmo(68), 'mixed');
  });

  it('ranks precip severity for route worst', () => {
    assert.equal(worsePrecip('rain', 'snow'), 'snow');
    assert.equal(worsePrecip('storm', 'snow'), 'storm');
    assert.equal(worsePrecip('none', 'rain'), 'rain');
  });

  it('samples polyline ends and midpoints with capped count', () => {
    const coords: [number, number][] = [];
    for (let i = 0; i < 100; i += 1) coords.push([50 + i * 0.01, 3 + i * 0.01]);
    const pts = sampleRouteWeatherPoints(coords, 5);
    assert.ok(pts.length >= 2);
    assert.ok(pts.length <= 5);
    assert.equal(pts[0].lat, coords[0][0]);
    assert.equal(pts[pts.length - 1].lat, coords[coords.length - 1][0]);
  });

  it('fetchWeatherAlongRoute detects rain and snow via injected fetch', async () => {
    const coords: [number, number][] = [
      [50.6, 3.0],
      [50.7, 3.1],
      [50.8, 3.2],
      [50.9, 3.3],
    ];
    let n = 0;
    const brief = await fetchWeatherAlongRoute(coords, {
      maxSamples: 4,
      fetchOne: async () => {
        n += 1;
        const snow = n === 2;
        const snap: WeatherSnapshot = {
          tempC: snow ? -2 : 8,
          weatherCode: snow ? 71 : 61,
          precipKind: snow ? 'snow' : 'rain',
          road: snow ? 'glacees' : 'ouvertes',
          updatedAt: new Date().toISOString(),
          source: 'open-meteo',
          label: 'test',
        };
        return snap;
      },
    });
    assert.equal(brief.hasRain, true);
    assert.equal(brief.hasSnow, true);
    assert.ok(brief.samples.length >= 2);
    assert.match(brief.label, /pluie|neige/);
  });
});
