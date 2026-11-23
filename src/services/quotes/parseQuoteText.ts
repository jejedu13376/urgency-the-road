/**
 * Module 3 — OCR-lite from pasted garage quote text (no ML Kit / Document AI).
 * Extracts numeric amounts; optional pièce / MO keyword anchoring.
 */

export type ParsedQuoteAmounts = {
  partPrice?: number;
  laborPrice?: number;
  amounts: number[];
  note: string;
};

function parseNumberToken(raw: string): number | null {
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/€|eur|usd|cad|aud|\$/gi, '')
    .replace(',', '.');
  // 1.234.56 European → strip thousand dots carefully
  let n = cleaned;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw.replace(/\s/g, '').replace(/€|\$/gi, ''))) {
    n = raw.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw.replace(/\s/g, '').replace(/€|\$/gi, ''))) {
    n = raw.replace(/\s/g, '').replace(/,/g, '');
  }
  const v = Number.parseFloat(n);
  return Number.isFinite(v) && v >= 0 && v < 1_000_000 ? Math.round(v * 100) / 100 : null;
}

const AMOUNT_RE =
  /(?:^|[^\d])(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|usd|cad|aud|\$)?/gi;

/**
 * Pull amounts from pasted devis text. Prefer keyword-anchored lines when present.
 */
export function parseQuoteTextAmounts(text: string): ParsedQuoteAmounts {
  const raw = text.trim();
  if (!raw) {
    return { amounts: [], note: 'Aucun texte — collez le devis garage (montants pièce / MO).' };
  }

  const amounts: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(AMOUNT_RE.source, 'gi');
  while ((m = re.exec(raw)) !== null) {
    const v = parseNumberToken(m[1]);
    if (v != null && v > 0) amounts.push(v);
  }

  let partPrice: number | undefined;
  let laborPrice: number | undefined;

  const lines = raw.split(/\n|;|\|/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const isPart = /pi[eè]ce|part|filtre|huile|plaquette|disque|oem|sku/i.test(line);
    const isLabor = /main.?d.?oeuvre|main.?d.?œuvre|mo\b|labor|pose|heure|h\.?\s*×|taux/i.test(line);
    const lineAmounts: number[] = [];
    const lr = new RegExp(AMOUNT_RE.source, 'gi');
    let lm: RegExpExecArray | null;
    while ((lm = lr.exec(line)) !== null) {
      const v = parseNumberToken(lm[1]);
      if (v != null && v > 0) lineAmounts.push(v);
    }
    if (lineAmounts.length) {
      if (isPart && partPrice == null) partPrice = lineAmounts[0];
      if (isLabor && laborPrice == null) laborPrice = lineAmounts[0];
    }
  }

  if (partPrice == null && laborPrice == null && amounts.length >= 2) {
    partPrice = amounts[0];
    laborPrice = amounts[1];
  } else if (partPrice == null && amounts.length === 1) {
    partPrice = amounts[0];
  }

  const note =
    partPrice != null || laborPrice != null
      ? `OCR-lite texte · pièce ${partPrice ?? '—'} · MO ${laborPrice ?? '—'} (${amounts.length} montant(s) détecté(s)) — pas ML Kit`
      : amounts.length
        ? `OCR-lite · ${amounts.length} montant(s) sans ancrage clair — précisez pièce/MO`
        : 'OCR-lite · aucun montant numérique détecté';

  return { partPrice, laborPrice, amounts, note };
}
