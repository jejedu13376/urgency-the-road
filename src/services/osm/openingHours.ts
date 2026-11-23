/**
 * Minimal OSM opening_hours advisory parser.
 * Used when a weighbridge / place has a static opening_hours tag.
 * This is NOT a live jurisdiction ON/OFF feed — never invent open if untagged.
 */

export type HoursAdvisory = {
  status: 'open' | 'closed' | 'unknown';
  litUp: boolean;
  note: string;
};

const DAY_IDX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

function parseHm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

function dayInRange(day: number, from: number, to: number): boolean {
  if (from <= to) return day >= from && day <= to;
  return day >= from || day <= to;
}

/**
 * Best-effort parse for common OSM patterns: 24/7, Mo-Fr 08:00-18:00, closed.
 * Complex rules (PH, month ranges, conditional) → unknown.
 */
export function advisoryFromOpeningHours(
  raw: string | undefined,
  now = new Date(),
): HoursAdvisory {
  if (!raw || !raw.trim()) {
    return {
      status: 'unknown',
      litUp: false,
      note: 'Pas de tag opening_hours — UNKNOWN (pas de feed ON/OFF live)',
    };
  }
  const oh = raw.trim();
  const lower = oh.toLowerCase();

  if (lower === '24/7' || lower === '24 hours' || lower.includes('24/7')) {
    return {
      status: 'open',
      litUp: true,
      note: `OSM opening_hours « ${oh} » → advisory OPEN (statique, pas feed live)`,
    };
  }
  if (lower === 'closed' || lower.startsWith('closed')) {
    return {
      status: 'closed',
      litUp: false,
      note: `OSM opening_hours « ${oh} » → advisory CLOSED (statique)`,
    };
  }

  // Mo-Su 08:00-20:00  |  Mo-Fr 06:00-22:00
  const m =
    /^(mo|tu|we|th|fr|sa|su)(?:-(mo|tu|we|th|fr|sa|su))?\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/i.exec(
      oh.replace(/\s+/g, ' ').trim(),
    );
  if (!m) {
    return {
      status: 'unknown',
      litUp: false,
      note: `opening_hours « ${oh} » trop complexe — UNKNOWN (pas de feed live)`,
    };
  }

  const fromDay = DAY_IDX[m[1].toLowerCase()];
  const toDay = m[2] ? DAY_IDX[m[2].toLowerCase()] : fromDay;
  const start = parseHm(m[3]);
  const end = parseHm(m[4]);
  if (fromDay == null || toDay == null || start == null || end == null) {
    return {
      status: 'unknown',
      litUp: false,
      note: `opening_hours « ${oh} » illisible — UNKNOWN`,
    };
  }

  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (!dayInRange(day, fromDay, toDay)) {
    return {
      status: 'closed',
      litUp: false,
      note: `OSM opening_hours « ${oh} » → advisory CLOSED (jour hors plage)`,
    };
  }

  const inWindow = start <= end ? mins >= start && mins < end : mins >= start || mins < end;
  if (inWindow) {
    return {
      status: 'open',
      litUp: true,
      note: `OSM opening_hours « ${oh} » → advisory OPEN (heure locale)`,
    };
  }
  return {
    status: 'closed',
    litUp: false,
    note: `OSM opening_hours « ${oh} » → advisory CLOSED (hors horaires)`,
  };
}
