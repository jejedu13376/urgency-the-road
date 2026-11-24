import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OVERSPEED_TTS_EN,
  OVERSPEED_TTS_FR,
  isOverSpeedLimit,
  mpsToKmh,
  resolveSpeedLimitFromProfile,
  speakOverspeedAlert,
} from './truckSpeedLimit';

describe('truckSpeedLimit', () => {
  it('resolves truck limit from poids_lourd + continent', () => {
    const eu = resolveSpeedLimitFromProfile({
      vehicleClass: 'poids_lourd',
      continent: 'EU',
      label: 'Scania',
    });
    assert.equal(eu.limitKmh, 90);

    const na = resolveSpeedLimitFromProfile({
      vehicleClass: 'poids_lourd',
      continent: 'NA',
      label: 'Peterbilt',
    });
    assert.equal(na.limitKmh, 105);
  });

  it('uses class defaults for light vehicles', () => {
    assert.equal(
      resolveSpeedLimitFromProfile({
        vehicleClass: 'voiture',
        continent: 'EU',
        label: 'Clio',
      }).limitKmh,
      130,
    );
    assert.equal(
      resolveSpeedLimitFromProfile({
        vehicleClass: 'pickup',
        continent: 'NA',
        label: 'F-150',
      }).limitKmh,
      110,
    );
  });

  it('detects overspeed from m/s vs profile limit', () => {
    // 100 km/h = 27.778 m/s — under 90+3 truck EU → over
    assert.equal(isOverSpeedLimit({ speedMps: 100 / 3.6, limitKmh: 90 }), true);
    // 90 km/h exact — within tolerance
    assert.equal(isOverSpeedLimit({ speedMps: 90 / 3.6, limitKmh: 90 }), false);
    assert.equal(mpsToKmh(null), null);
  });

  it('speakOverspeedAlert is loud TTS FR then EN', async () => {
    const spoken: string[] = [];
    await speakOverspeedAlert({
      cycles: 1,
      limitKmh: 90,
      speak: async (language, text) => {
        spoken.push(`${language}:${text.slice(0, 20)}`);
      },
    });
    assert.equal(spoken.length, 2);
    assert.ok(spoken[0].startsWith('fr-FR:'));
    assert.ok(spoken[1].startsWith('en-US:'));
    assert.ok(OVERSPEED_TTS_FR.length > 20);
    assert.ok(OVERSPEED_TTS_EN.length > 20);
  });
});
