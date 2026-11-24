import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enrichParsedDtcs, lookupDtcCode, normalizeDtcCode } from './dtcDictionary';
import { parseMode03Dtcs, parseRpm, parseEct } from './elm327Protocol';

describe('dtcDictionary', () => {
  it('normalizes and looks up known codes', () => {
    assert.equal(normalizeDtcCode(' p0301 '), 'P0301');
    const hit = lookupDtcCode('P0301');
    assert.equal(hit.code, 'P0301');
    assert.match(hit.plainLanguage, /Raté/i);
    assert.ok(hit.repairGuide.length > 0);
  });

  it('returns honest unknown for missing codes', () => {
    const miss = lookupDtcCode('P9999');
    assert.equal(miss.code, 'P9999');
    assert.match(miss.plainLanguage, /dictionnaire local/i);
  });

  it('enriches parsed DTC list', () => {
    const enriched = enrichParsedDtcs([
      { code: 'P0301', plainLanguage: 'x', severity: 'info' },
      { code: 'P1111', plainLanguage: 'y', severity: 'warn' },
    ]);
    assert.equal(enriched[0].repairGuide.length > 0, true);
    assert.match(enriched[0].plainLanguage, /Raté/i);
    assert.equal(enriched[1].code, 'P1111');
  });
});

describe('elm327Protocol parsers', () => {
  it('parses RPM and ECT from Mode 01 echoes', () => {
    // 41 0C high low → RPM = ((A*256)+B)/4
    assert.equal(parseRpm('410C0B B8'), 750);
    // 41 05 A → °C = A - 40
    assert.equal(parseEct('41055A'), 50);
  });

  it('parses Mode 03 DTC payload with count byte', () => {
    // 43 01 00 01 → count=1, code P0001-ish from 00 01
    const list = parseMode03Dtcs('43010001');
    assert.ok(list.length >= 1);
    assert.match(list[0].code, /^[PCBU]/);
  });
});
