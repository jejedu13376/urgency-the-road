/**
 * Pure referral helpers — codes, deep links, normalize.
 * Dyslexia-friendly codes: uppercase alnum, no 0/O/1/I ambiguity.
 * Codes are random (not derived from uid) so they cannot be predicted / squatted.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeReferralCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

/**
 * Random UR + 6 dyslexia-safe chars. Persist on UserDoc once — do not regenerate.
 * `_uid` kept for call-site compatibility; unused on purpose (non-deterministic).
 */
export function generateReferralCode(_uid?: string): string {
  let out = 'UR';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    out += CODE_ALPHABET[idx]!;
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
  return /^UR[A-Z2-9]{6,10}$/.test(n);
}
