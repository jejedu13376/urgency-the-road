/**
 * Module 13 — offline medical QR payload encode/decode.
 * QR is generated on-device (no server). Printed value carries a compact
 * self-contained envelope so authorized rescuer scans work without network.
 * Plain UM-QR-* codes still resolve via on-device AsyncStorage when present.
 */
import type { MedicalCardDoc, MedicalEmergencyView } from '../../types/firestore';

export const OFFLINE_QR_PREFIX = 'UMQR1:';

/** Compact PHI envelope embedded in printed QR (v1). */
export type OfflineQrPayloadV1 = {
  v: 1;
  scanCode: string;
  fullName: string;
  address?: string;
  bloodType?: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  emergencyContacts: { name: string; phone: string }[];
  notes?: string;
  updatedAt: string;
};

export type ParsedQrScan =
  | { kind: 'offline'; payload: OfflineQrPayloadV1; scanCode: string }
  | { kind: 'scanCode'; scanCode: string }
  | { kind: 'unknown'; raw: string };

const B64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** UTF-8 → base64 without relying on Buffer/btoa (works in RN + Node tests). */
export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64[(triple >> 18) & 63];
    out += B64[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[triple & 63] : '=';
  }
  return out;
}

export function base64ToUtf8(b64: string): string {
  // Keep `=` padding — stripping it corrupts the final quartet.
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c2 = clean[i + 2] ?? '=';
    const c3 = clean[i + 3] ?? '=';
    const n =
      (B64.indexOf(clean[i]!) << 18) |
      (B64.indexOf(clean[i + 1]!) << 12) |
      ((c2 === '=' ? 0 : B64.indexOf(c2)) << 6) |
      (c3 === '=' ? 0 : B64.indexOf(c3));
    bytes.push((n >> 16) & 255);
    if (c2 !== '=') bytes.push((n >> 8) & 255);
    if (c3 !== '=') bytes.push(n & 255);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export function cardToOfflinePayload(card: MedicalCardDoc): OfflineQrPayloadV1 {
  return {
    v: 1,
    scanCode: card.scanCode.trim().toUpperCase(),
    fullName: card.fullName,
    address: card.address,
    bloodType: card.bloodType,
    allergies: card.allergies ?? [],
    conditions: card.conditions ?? [],
    medications: card.medications ?? [],
    emergencyContacts: card.emergencyContacts ?? [],
    notes: card.notes,
    updatedAt: card.updatedAt || new Date().toISOString(),
  };
}

export function offlinePayloadToEmergencyView(
  payload: OfflineQrPayloadV1,
): MedicalEmergencyView {
  return {
    kind: 'emergency_full',
    scanCode: payload.scanCode,
    fullName: payload.fullName,
    address: payload.address?.trim() || 'Adresse non renseignée',
    emergencyContact: payload.emergencyContacts[0] ?? null,
    bloodType: payload.bloodType,
    allergies: payload.allergies ?? [],
    conditions: payload.conditions ?? [],
    medications: payload.medications ?? [],
    notes: payload.notes,
  };
}

export function offlinePayloadToCard(
  payload: OfflineQrPayloadV1,
  ownerUid = 'offline-local',
): MedicalCardDoc {
  return {
    id: `med-offline-${payload.scanCode}`,
    ownerUid,
    scanCode: payload.scanCode,
    fullName: payload.fullName,
    address: payload.address,
    allergies: payload.allergies ?? [],
    conditions: payload.conditions ?? [],
    medications: payload.medications ?? [],
    emergencyContacts: payload.emergencyContacts ?? [],
    bloodType: payload.bloodType,
    notes: payload.notes,
    subscriberActive: true,
    updatedAt: payload.updatedAt,
  };
}

/** Value encoded into the printed QR image (local generate, no server). */
export function encodeOfflineQrValue(payload: OfflineQrPayloadV1): string {
  return `${OFFLINE_QR_PREFIX}${utf8ToBase64(JSON.stringify(payload))}`;
}

export function encodeOfflineQrFromCard(card: MedicalCardDoc): string {
  return encodeOfflineQrValue(cardToOfflinePayload(card));
}

function isOfflinePayload(value: unknown): value is OfflineQrPayloadV1 {
  if (!value || typeof value !== 'object') return false;
  const v = value as OfflineQrPayloadV1;
  return (
    v.v === 1 &&
    typeof v.scanCode === 'string' &&
    v.scanCode.startsWith('UM-QR-') &&
    typeof v.fullName === 'string' &&
    Array.isArray(v.allergies) &&
    Array.isArray(v.conditions) &&
    Array.isArray(v.medications) &&
    Array.isArray(v.emergencyContacts)
  );
}

/** Parse camera / manual scan input — offline envelope or opaque UM-QR-* code. */
export function parseScannedQrValue(raw: string): ParsedQrScan {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'unknown', raw };

  if (trimmed.toUpperCase().startsWith(OFFLINE_QR_PREFIX)) {
    const b64 = trimmed.slice(OFFLINE_QR_PREFIX.length);
    try {
      const parsed: unknown = JSON.parse(base64ToUtf8(b64));
      if (isOfflinePayload(parsed)) {
        const scanCode = parsed.scanCode.trim().toUpperCase();
        return {
          kind: 'offline',
          payload: { ...parsed, scanCode },
          scanCode,
        };
      }
    } catch {
      /* fall through */
    }
    return { kind: 'unknown', raw: trimmed };
  }

  const upper = trimmed.toUpperCase();
  if (upper.startsWith('UM-QR-')) {
    return { kind: 'scanCode', scanCode: upper };
  }

  return { kind: 'unknown', raw: trimmed };
}

/** Extract display / lookup scanCode from any accepted QR value. */
export function extractScanCode(raw: string): string {
  const parsed = parseScannedQrValue(raw);
  if (parsed.kind === 'offline' || parsed.kind === 'scanCode') return parsed.scanCode;
  return raw.trim().toUpperCase();
}
