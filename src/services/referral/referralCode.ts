/**
 * Pure referral helpers — codes, deep links, normalize.
 * Dyslexia-friendly codes: uppercase alnum, no 0/O/1/I ambiguity.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeReferralCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

/** Stable-ish code from uid + salt so the same user keeps the same code offline. */
export function generateReferralCode(uid: string): string {
  const seed = `UM-REF-${uid}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = 'UR';
  let x = h >>> 0;
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[x % CODE_ALPHABET.length];
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  }
  return out;
}

export function buildReferralLink(baseUrl: string, code: string): string {
  const clean = normalizeReferralCode(code);
  const base = baseUrl.trim().replace(/\/$/, '');
  if (!base.startsWith('http') || !clean) return '';
  try {
    const u = new URL(base);
    u.searchParams.set('ref', clean);
    return u.toString();
  } catch {
    const join = base.includes('?') ? '&' : '?';
    return `${base}${join}ref=${encodeURIComponent(clean)}`;
  }
}

export function parseReferralCodeFromUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const fromQuery = u.searchParams.get('ref') ?? u.searchParams.get('referral');
    if (fromQuery) {
      const n = normalizeReferralCode(fromQuery);
      return n.length >= 4 ? n : null;
    }
    const pathMatch = u.pathname.match(/\/(?:ref|parrainage|referral)\/([A-Za-z0-9_-]+)/i);
    if (pathMatch?.[1]) {
      const n = normalizeReferralCode(pathMatch[1]);
      return n.length >= 4 ? n : null;
    }
  } catch {
    const m = raw.match(/[?&#]ref=([A-Za-z0-9_-]+)/i);
    if (m?.[1]) {
      const n = normalizeReferralCode(m[1]);
      return n.length >= 4 ? n : null;
    }
  }
  return null;
}

export function isValidReferralCodeShape(code: string): boolean {
  const n = normalizeReferralCode(code);
  return n.length >= 4 && n.length <= 12;
}
