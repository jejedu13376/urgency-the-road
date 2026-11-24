import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_TRUCKER_PROFILE, type TruckerProfile } from '../prefs/truckerProfilePrefs';
import { buildRouteRulesFromProfile } from './routeRules';

describe('buildRouteRulesFromProfile', () => {
  it('marks standard EU trek + dry van as mostly allowed on height/weight', () => {
    const profile: TruckerProfile = {
      ...DEFAULT_TRUCKER_PROFILE,
      truckType: 'trek',
      heightM: 3.9,
      widthM: 2.55,
      lengthM: 16.5,
      weightT: 40,
      trailerType: 'dry_van',
      specialEquipment: [],
      region: 'EU',
    };
    const rules = buildRouteRulesFromProfile(profile);
    assert.ok(rules.allowed.some((r) => r.id === 'h-ok'));
    assert.ok(rules.allowed.some((r) => r.id === 'wt-ok'));
    assert.ok(rules.restricted.some((r) => r.id === 'reg-eu-sun'));
    assert.match(rules.honesty, /Advisory/);
  });

  it('restricts high / heavy / hazmat / tanker profiles', () => {
    const profile: TruckerProfile = {
      ...DEFAULT_TRUCKER_PROFILE,
      heightM: 4.5,
      weightT: 48,
      widthM: 2.7,
      lengthM: 20,
      trailerType: 'tanker',
      specialEquipment: ['hazmat_adr', 'wide_load'],
      region: 'NA',
    };
    const rules = buildRouteRulesFromProfile(profile);
    const ids = new Set(rules.restricted.map((r) => r.id));
    assert.ok(ids.has('h-gt-42'));
    assert.ok(ids.has('wt-gt-44'));
    assert.ok(ids.has('w-gt-26'));
    assert.ok(ids.has('l-gt-1875'));
    assert.ok(ids.has('eq-hazmat'));
    assert.ok(ids.has('eq-wide'));
    assert.ok(ids.has('tr-tanker-ban'));
    assert.ok(ids.has('reg-na-scale'));
  });

  it('adds livestock and reefer trailer advisories', () => {
    const live = buildRouteRulesFromProfile({
      ...DEFAULT_TRUCKER_PROFILE,
      trailerType: 'livestock',
    });
    assert.ok(live.restricted.some((r) => r.id === 'tr-live-ban'));
    const reefer = buildRouteRulesFromProfile({
      ...DEFAULT_TRUCKER_PROFILE,
      trailerType: 'reefer',
    });
    assert.ok(reefer.allowed.some((r) => r.id === 'tr-reefer-ok'));
  });
});
