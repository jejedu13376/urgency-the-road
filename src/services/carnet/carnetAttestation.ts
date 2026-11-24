/**
 * Module 10 — local carnet attestation (integrity hash).
 * Not a server-signed / legally certified PDF — full-payload digest only.
 */

export type CarnetAttestationInput = {
  vehicleLabel: string;
  vin?: string;
  odometerKm: number;
  entries: {
    title: string;
    km: number;
    dateIso: string;
    cost?: number;
    currency?: string;
    invoiceRef?: string;
  }[];
  maintenanceDone?: string[];
  /** ISO timestamp frozen into the hash */
  exportedAtIso: string;
};

export type CarnetAttestation = {
  algorithm: 'fnv1a-fold64';
  hash: string;
  exportedAtIso: string;
  entryCount: number;
  /** Honesty label for UI / PDF footer */
  label: string;
};

/** FNV-1a 32-bit over an entire string (full coverage). */
function fnv1a32(chunk: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < chunk.length; i++) {
    h ^= chunk.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic content digest covering the **entire** canonical string.
 * Two independent FNV-1a passes + length mixing → 64 hex chars (no crypto dep).
 */
export function digestCarnetPayload(canonical: string): string {
  if (!canonical.length) {
    return '0'.repeat(64);
  }
  // Full-string walks — any later-entry edit changes both seeds.
  let a = fnv1a32(canonical, 0x811c9dc5);
  let b = fnv1a32(canonical, 0xcbf29ce4);
  // Contiguous segment coverage (8 slices spanning 0..n) for avalanche.
  const n = canonical.length;
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const start = Math.floor((i * n) / 8);
    const end = Math.floor(((i + 1) * n) / 8) || n;
    const slice = canonical.slice(start, end);
    a = fnv1a32(`${a.toString(16)}|${i}|${n}|${slice}`, a);
    b = fnv1a32(`${b.toString(16)}|${n - i}|${slice}|${canonical.length}`, b);
    const mixed = (a ^ Math.imul(b, 0x01000193 + i)) >>> 0;
    parts.push(mixed.toString(16).padStart(8, '0'));
  }
  return parts.join('');
}

export function buildCanonicalCarnet(input: CarnetAttestationInput): string {
  const lines = [
    'UM-CARNET-V1',
    input.exportedAtIso,
    input.vehicleLabel.trim(),
    (input.vin ?? '').trim().toUpperCase(),
    String(input.odometerKm),
    ...(input.maintenanceDone ?? []).map((t) => `M:${t.trim()}`),
    ...input.entries.map(
      (e) =>
        `E:${e.dateIso}|${e.km}|${e.title.trim()}|${e.cost ?? ''}|${e.currency ?? ''}|${e.invoiceRef ?? ''}`,
    ),
  ];
  return lines.join('\n');
}

export function attestCarnet(input: CarnetAttestationInput): CarnetAttestation {
  const canonical = buildCanonicalCarnet(input);
  const hash = digestCarnetPayload(canonical);
  return {
    algorithm: 'fnv1a-fold64',
    hash,
    exportedAtIso: input.exportedAtIso,
    entryCount: input.entries.length,
    label: `Attestation locale ${hash.slice(0, 12)}… — intégrité appareil, pas signature serveur`,
  };
}
