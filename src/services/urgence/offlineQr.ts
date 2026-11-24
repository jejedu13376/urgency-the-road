/**
 * Module 13 — offline medical QR helpers.
 * Printed QR encodes only the opaque UM-QR-* id (local SVG generate, no server).
 * PHI lives on-device in AsyncStorage / Firestore — never in the printed code.
 * Legacy UMQR1: envelopes (if scanned) yield scanCode only; PHI fields are discarded.
 */
export const OFFLINE_QR_PREFIX = 'UMQR1:';

export type ParsedQrScan =
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

/**
 * Value encoded into the printed QR image — opaque id only (no PHI).
 * Generated on-device; no server image API.
 */
export function encodePrintableQrValue(scanCode: string): string {
  const code = scanCode.trim().toUpperCase();
  return code.startsWith('UM-QR-') ? code : '';
}

/** Extract scanCode from a legacy UMQR1: envelope; discard PHI fields. */
function scanCodeFromLegacyEnvelope(b64: string): string | null {
  try {
    const parsed: unknown = JSON.parse(base64ToUtf8(b64));
    if (!parsed || typeof parsed !== 'object') return null;
    const scanCode = (parsed as { scanCode?: unknown }).scanCode;
    if (typeof scanCode !== 'string') return null;
    const code = scanCode.trim().toUpperCase();
    return code.startsWith('UM-QR-') ? code : null;
  } catch {
    return null;
  }
}

/**
 * Parse camera / manual scan input.
 * Opaque UM-QR-* or legacy UMQR1: → scanCode only (never trusts embedded PHI).
 */
export function parseScannedQrValue(raw: string): ParsedQrScan {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'unknown', raw };

  if (trimmed.toUpperCase().startsWith(OFFLINE_QR_PREFIX)) {
    const code = scanCodeFromLegacyEnvelope(trimmed.slice(OFFLINE_QR_PREFIX.length));
    if (code) return { kind: 'scanCode', scanCode: code };
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
  if (parsed.kind === 'scanCode') return parsed.scanCode;
  return raw.trim().toUpperCase();
}
