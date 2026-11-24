import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  base64ToUtf8,
  encodePrintableQrValue,
  extractScanCode,
  OFFLINE_QR_PREFIX,
  parseScannedQrValue,
  utf8ToBase64,
} from './offlineQr';

describe('offlineQr', () => {
  it('round-trips utf8 base64', () => {
    const src = 'fiche médicale — café 🚑';
    assert.equal(base64ToUtf8(utf8ToBase64(src)), src);
  });

  it('prints only opaque UM-QR-* (never PHI envelope)', () => {
    assert.equal(
      encodePrintableQrValue('um-qr-ABCDEFGHijklmnop'),
      'UM-QR-ABCDEFGHIJKLMNOP',
    );
    assert.equal(encodePrintableQrValue(''), '');
    assert.equal(encodePrintableQrValue('https://evil.example'), '');
    const printed = encodePrintableQrValue('UM-QR-ABCDEFGHIJKLMNOP');
    assert.equal(printed.startsWith(OFFLINE_QR_PREFIX), false);
    assert.match(printed, /^UM-QR-[A-Z0-9]+$/);
  });

  it('parses opaque scan codes without network', () => {
    const parsed = parseScannedQrValue('um-qr-ABCDEFGHijklmnop');
    assert.deepEqual(parsed, {
      kind: 'scanCode',
      scanCode: 'UM-QR-ABCDEFGHIJKLMNOP',
    });
  });

  it('legacy UMQR1: yields scanCode only — discards embedded PHI', () => {
    const legacy = {
      v: 1,
      scanCode: 'UM-QR-ABCDEFGHIJKLMNOP',
      fullName: 'Attacker Spoof',
      allergies: ['Fake'],
      conditions: [],
      medications: [],
      emergencyContacts: [],
      updatedAt: '2026-11-23T18:00:00.000Z',
    };
    const raw = `${OFFLINE_QR_PREFIX}${utf8ToBase64(JSON.stringify(legacy))}`;
    const parsed = parseScannedQrValue(raw);
    assert.deepEqual(parsed, {
      kind: 'scanCode',
      scanCode: 'UM-QR-ABCDEFGHIJKLMNOP',
    });
    // Must not surface PHI fields from the envelope.
    assert.equal('payload' in parsed, false);
  });

  it('rejects unknown payloads', () => {
    assert.equal(parseScannedQrValue('https://example.com').kind, 'unknown');
    assert.equal(parseScannedQrValue('UMQR1:%%%').kind, 'unknown');
  });

  it('extractScanCode works for opaque and legacy envelope', () => {
    const legacy = `${OFFLINE_QR_PREFIX}${utf8ToBase64(
      JSON.stringify({ scanCode: 'UM-QR-ABCDEFGHIJKLMNOP', fullName: 'X' }),
    )}`;
    assert.equal(extractScanCode(legacy), 'UM-QR-ABCDEFGHIJKLMNOP');
    assert.equal(extractScanCode('UM-QR-ABCDEFGHIJKLMNOP'), 'UM-QR-ABCDEFGHIJKLMNOP');
  });
});
