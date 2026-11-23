import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MedicalCardDoc } from '../../types/firestore';
import {
  base64ToUtf8,
  cardToOfflinePayload,
  encodeOfflineQrFromCard,
  encodeOfflineQrValue,
  extractScanCode,
  offlinePayloadToEmergencyView,
  parseScannedQrValue,
  utf8ToBase64,
} from './offlineQr';

const SAMPLE: MedicalCardDoc = {
  id: 'med-u1',
  ownerUid: 'u1',
  scanCode: 'UM-QR-ABCDEFGHijklmnop',
  fullName: 'Alex Test',
  address: '1 rue Demo',
  allergies: ['Pénicilline'],
  conditions: ['Asthme'],
  medications: ['Ventoline'],
  emergencyContacts: [{ name: 'Sam', phone: '+33600000000' }],
  bloodType: 'O+',
  subscriberActive: true,
  updatedAt: '2026-11-23T18:00:00.000Z',
};

describe('offlineQr', () => {
  it('round-trips utf8 base64', () => {
    const src = 'fiche médicale — café 🚑';
    assert.equal(base64ToUtf8(utf8ToBase64(src)), src);
  });

  it('encodes a self-contained offline QR value', () => {
    const value = encodeOfflineQrFromCard(SAMPLE);
    assert.match(value, /^UMQR1:/);
    const parsed = parseScannedQrValue(value);
    assert.equal(parsed.kind, 'offline');
    if (parsed.kind !== 'offline') return;
    assert.equal(parsed.scanCode, 'UM-QR-ABCDEFGHIJKLMNOP');
    assert.equal(parsed.payload.fullName, 'Alex Test');
    assert.deepEqual(parsed.payload.allergies, ['Pénicilline']);
  });

  it('parses opaque scan codes without network', () => {
    const parsed = parseScannedQrValue('um-qr-ABCDEFGHijklmnop');
    assert.deepEqual(parsed, {
      kind: 'scanCode',
      scanCode: 'UM-QR-ABCDEFGHIJKLMNOP',
    });
  });

  it('rejects unknown payloads', () => {
    assert.equal(parseScannedQrValue('https://example.com').kind, 'unknown');
    assert.equal(parseScannedQrValue('UMQR1:%%%').kind, 'unknown');
  });

  it('maps offline payload to emergency view', () => {
    const view = offlinePayloadToEmergencyView(cardToOfflinePayload(SAMPLE));
    assert.equal(view.kind, 'emergency_full');
    assert.equal(view.fullName, 'Alex Test');
    assert.equal(view.emergencyContact?.phone, '+33600000000');
  });

  it('extractScanCode works for envelope and plain code', () => {
    const env = encodeOfflineQrValue(cardToOfflinePayload(SAMPLE));
    assert.equal(extractScanCode(env), 'UM-QR-ABCDEFGHIJKLMNOP');
    assert.equal(extractScanCode('UM-QR-ABCDEFGHIJKLMNOP'), 'UM-QR-ABCDEFGHIJKLMNOP');
  });
});
