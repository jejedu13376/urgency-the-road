import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export type RateLimitConfig = {
  /** Max POSTs per UID per rolling window (one diagnostic ≈ up to 6 parallel engine calls). */
  maxPerWindow: number;
  windowMs: number;
  /** Max POSTs per UID per UTC calendar day (spend soft-cap). */
  maxPerDay: number;
};

function readConfig(): RateLimitConfig {
  const maxPerWindow = Number(process.env.MULTI_IA_RATE_LIMIT_MAX ?? '30');
  const windowMs = Number(process.env.MULTI_IA_RATE_LIMIT_WINDOW_MS ?? '60000');
  const maxPerDay = Number(process.env.MULTI_IA_DAILY_MAX ?? '200');
  return {
    maxPerWindow: Number.isFinite(maxPerWindow) && maxPerWindow > 0 ? maxPerWindow : 30,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
    maxPerDay: Number.isFinite(maxPerDay) && maxPerDay > 0 ? maxPerDay : 200,
  };
}

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function rateError(code: string, message: string, retryAfterSec?: number): never {
  const err = new Error(message) as Error & {
    status: number;
    code: string;
    retryAfterSec?: number;
  };
  err.status = 429;
  err.code = code;
  if (retryAfterSec != null) err.retryAfterSec = retryAfterSec;
  throw err;
}

/**
 * Atomic per-UID rate + daily quota via Firestore.
 * Collection: `multiIaRateLimits/{uid}` (server-only; not used by the client SDK).
 */
export async function assertWithinRateLimit(uid: string): Promise<RateLimitConfig> {
  const cfg = readConfig();
  const ref = getFirestore().collection('multiIaRateLimits').doc(uid);
  const now = Date.now();
  const day = utcDayKey();

  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as
      | {
          windowStartMs?: number;
          windowCount?: number;
          dayKey?: string;
          dayCount?: number;
        }
      | undefined;

    let windowStartMs = data?.windowStartMs ?? now;
    let windowCount = data?.windowCount ?? 0;
    if (now - windowStartMs >= cfg.windowMs) {
      windowStartMs = now;
      windowCount = 0;
    }

    let dayKey = data?.dayKey ?? day;
    let dayCount = data?.dayCount ?? 0;
    if (dayKey !== day) {
      dayKey = day;
      dayCount = 0;
    }

    if (windowCount >= cfg.maxPerWindow) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((windowStartMs + cfg.windowMs - now) / 1000),
      );
      rateError(
        'rate/window',
        'Too many Multi-IA requests — retry shortly',
        retryAfterSec,
      );
    }
    if (dayCount >= cfg.maxPerDay) {
      rateError('rate/daily', 'Daily Multi-IA quota reached — try again tomorrow');
    }

    tx.set(
      ref,
      {
        windowStartMs,
        windowCount: windowCount + 1,
        dayKey,
        dayCount: dayCount + 1,
        updatedAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return cfg;
}
