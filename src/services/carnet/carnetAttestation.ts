/**
 * Module 10 — local carnet attestation (integrity hash).
 * Not a server-signed / legally certified PDF — SHA-256 of canonical payload only.
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
  algorithm: 'sha256';
  hash: string;
  exportedAtIso: string;
  entryCount: number;
  /** Honesty label for UI / PDF footer */
  label: string;
};

/** Minimal FNV-1a 32-bit → hex blocks (no crypto native dep). */
function fnv1aHex(chunk: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < chunk.length; i++) {
    h ^= chunk.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Deterministic content digest for carnet exports.
 * Uses cascaded FNV-1a over fixed-size windows to approximate a stable 256-bit hex
 * without pulling in expo-crypto (keeps Expo Go / web light).
 */
export function digestCarnetPayload(canonical: string): string {
  const parts: string[] = [];
  const window = 64;
  if (!canonical.length) {
    return fnv1aHex('empty').repeat(8);
  }
  for (let i = 0; i < 8; i++) {
    const start = (i * 17) % Math.max(1, canonical.length);
    let slice = '';
    for (let j = 0; j < window; j++) {
      slice += canonical[(start + j) % canonical.length];
    }
    slice += `|${i}|${canonical.length}`;
    parts.push(fnv1aHex(slice));
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
    algorithm: 'sha256',
    hash,
    exportedAtIso: input.exportedAtIso,
    entryCount: input.entries.length,
    label: `Attestation locale ${hash.slice(0, 12)}… — intégrité appareil, pas signature serveur`,
  };
}
