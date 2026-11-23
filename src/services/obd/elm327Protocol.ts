/**
 * ELM327 / OBD2 AT-command helpers + light J1939 framing notes.
 * Used by BLE session after GATT connect — no hardware faking.
 */

export type PidSnapshot = {
  rpm: number | null;
  ectC: number | null;
  batV: number | null;
  mapKpa: number | null;
};

export type ParsedDtc = {
  code: string;
  plainLanguage: string;
  severity: 'info' | 'warn' | 'critical';
};

/** Standard ELM327 init sequence (car OBD2 / EOBD). */
export const ELM327_INIT_AT: string[] = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];

/** Heavy-duty init hints — many BLE PL adapters still speak ELM-like AT; J1939 uses different PIDs. */
export const J1939_INIT_AT: string[] = ['ATZ', 'ATE0', 'ATL0', 'ATSPB', 'ATSH7E0'];

export function encodeElmCommand(cmd: string): string {
  return `${cmd.trim().toUpperCase()}\r`;
}

/** Parse Mode 01 PID 0C (RPM) from ELM hex response. */
export function parseRpm(hexLine: string): number | null {
  const bytes = extractDataBytes(hexLine, '41', '0C');
  if (!bytes || bytes.length < 2) return null;
  return Math.round(((bytes[0] * 256 + bytes[1]) / 4) * 10) / 10;
}

/** Parse Mode 01 PID 05 (coolant °C). */
export function parseEct(hexLine: string): number | null {
  const bytes = extractDataBytes(hexLine, '41', '05');
  if (!bytes || bytes.length < 1) return null;
  return bytes[0] - 40;
}

/** Parse Mode 01 PID 0B (MAP kPa). */
export function parseMap(hexLine: string): number | null {
  const bytes = extractDataBytes(hexLine, '41', '0B');
  if (!bytes || bytes.length < 1) return null;
  return bytes[0];
}

/** Parse Mode 01 PID 42 (control module voltage) — 0.001 V. */
export function parseVoltage(hexLine: string): number | null {
  const bytes = extractDataBytes(hexLine, '41', '42');
  if (!bytes || bytes.length < 2) return null;
  return Math.round(((bytes[0] * 256 + bytes[1]) * 0.001) * 100) / 100;
}

/**
 * Mode 03 DTC list → P0xxx style codes.
 * ISO 15765-4 / SAE J1979: after `43`, first data byte is DTC count, then N×2-byte codes.
 */
export function parseMode03Dtcs(hexLine: string): ParsedDtc[] {
  const cleaned = hexLine.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  const idx = cleaned.indexOf('43');
  if (idx < 0) return [];
  const afterMode = cleaned.slice(idx + 2);
  if (afterMode.length < 2) return [];

  const countByte = parseInt(afterMode.slice(0, 2), 16);
  if (Number.isNaN(countByte)) return [];

  // Skip DTC-count byte (CAN / ISO 15765-4). Clamp to remaining pairs.
  const pairsAvailable = Math.floor((afterMode.length - 2) / 4);
  const count = Math.min(Math.max(countByte, 0), pairsAvailable, 16);
  const payload = afterMode.slice(2);

  const out: ParsedDtc[] = [];
  for (let i = 0; i < count; i++) {
    const off = i * 4;
    if (off + 4 > payload.length) break;
    const a = parseInt(payload.slice(off, off + 2), 16);
    const b = parseInt(payload.slice(off + 2, off + 4), 16);
    if (a === 0 && b === 0) continue;
    const code = toDtcCode(a, b);
    out.push({
      code,
      plainLanguage: `Code ${code} lu via ELM327 (explication détaillée locale à enrichir).`,
      severity: code.startsWith('P0') ? 'warn' : 'critical',
    });
  }
  return out;
}

function toDtcCode(a: number, b: number): string {
  const type = ['P', 'C', 'B', 'U'][(a & 0xc0) >> 6] ?? 'P';
  const d1 = (a & 0x30) >> 4;
  const d2 = a & 0x0f;
  const d3 = (b & 0xf0) >> 4;
  const d4 = b & 0x0f;
  return `${type}${d1}${d2.toString(16).toUpperCase()}${d3.toString(16).toUpperCase()}${d4.toString(16).toUpperCase()}`;
}

function extractDataBytes(hexLine: string, modeEcho: string, pid: string): number[] | null {
  const cleaned = hexLine.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  const needle = `${modeEcho}${pid}`.toUpperCase();
  const idx = cleaned.indexOf(needle);
  if (idx < 0) return null;
  const data = cleaned.slice(idx + needle.length);
  const bytes: number[] = [];
  for (let i = 0; i + 2 <= data.length; i += 2) {
    bytes.push(parseInt(data.slice(i, i + 2), 16));
  }
  return bytes;
}

export function emptyPidSnapshot(): PidSnapshot {
  return { rpm: null, ectC: null, batV: null, mapKpa: null };
}
