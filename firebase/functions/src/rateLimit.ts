import {
  FieldValue,
  getFirestore,
  type DocumentReference,
} from 'firebase-admin/firestore';

export type RateLimitConfig = {
  /** Max POSTs per UID per rolling window (one diagnostic ≈ up to 6 parallel engine calls). */
  maxPerWindow: number;
  windowMs: number;
  /** Max POSTs per UID per UTC calendar day (spend soft-cap). */
  maxPerDay: number;
  /** Project-wide POSTs per UTC day (bounds account farming). */
  globalMaxPerDay: number;
  /** Max POSTs per IP hash per rolling window (hybrid with UID). */
  maxPerIpWindow: number;
};

function readConfig(): RateLimitConfig {
  const maxPerWindow = Number(process.env.MULTI_IA_RATE_LIMIT_MAX ?? '30');
  const windowMs = Number(process.env.MULTI_IA_RATE_LIMIT_WINDOW_MS ?? '60000');
  const maxPerDay = Number(process.env.MULTI_IA_DAILY_MAX ?? '200');
  const globalMaxPerDay = Number(process.env.MULTI_IA_GLOBAL_DAILY_MAX ?? '2000');
  const maxPerIpWindow = Number(process.env.MULTI_IA_IP_RATE_LIMIT_MAX ?? '60');
  return {
    maxPerWindow: Number.isFinite(maxPerWindow) && maxPerWindow > 0 ? maxPerWindow : 30,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
    maxPerDay: Number.isFinite(maxPerDay) && maxPerDay > 0 ? maxPerDay : 200,
    globalMaxPerDay:
      Number.isFinite(globalMaxPerDay) && globalMaxPerDay > 0 ? globalMaxPerDay : 2000,
    maxPerIpWindow:
      Number.isFinite(maxPerIpWindow) && maxPerIpWindow > 0 ? maxPerIpWindow : 60,
  };
}

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Stable short hash of client IP for Firestore doc ids (not reversible for privacy). */
export function hashIp(ip: string): string {
  const raw = ip.trim() || 'unknown';
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `ip_${(h >>> 0).toString(16)}`;
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

type CounterDoc = {
  windowStartMs?: number;
  windowCount?: number;
  dayKey?: string;
  dayCount?: number;
};

async function bumpCounter(
  ref: DocumentReference,
  cfg: RateLimitConfig,
  now: number,
  day: string,
  opts: {
    enforceWindow: boolean;
    windowMax: number;
    enforceDay: boolean;
    dayMax: number;
    windowCode: string;
    dayCode: string;
  },
): Promise<void> {
  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as CounterDoc | undefined;

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

    if (opts.enforceWindow && windowCount >= opts.windowMax) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((windowStartMs + cfg.windowMs - now) / 1000),
      );
      rateError(opts.windowCode, 'Too many Multi-IA requests — retry shortly', retryAfterSec);
    }
    if (opts.enforceDay && dayCount >= opts.dayMax) {
      rateError(opts.dayCode, 'Multi-IA quota reached — try again later');
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
}

/**
 * Per-UID + per-IP window + project-wide daily caps via Firestore.
 * Docs: `multiIaRateLimits/{uid}`, `multiIaRateLimits/{ipHash}`, `multiIaRateLimits/_global`.
 */
export async function assertWithinRateLimit(
  uid: string,
  clientIp?: string,
): Promise<RateLimitConfig> {
  const cfg = readConfig();
  const db = getFirestore();
  const now = Date.now();
  const day = utcDayKey();

  await bumpCounter(db.collection('multiIaRateLimits').doc(uid), cfg, now, day, {
    enforceWindow: true,
    windowMax: cfg.maxPerWindow,
    enforceDay: true,
    dayMax: cfg.maxPerDay,
    windowCode: 'rate/window',
    dayCode: 'rate/daily',
  });

  const ipKey = hashIp(clientIp ?? 'unknown');
  await bumpCounter(db.collection('multiIaRateLimits').doc(ipKey), cfg, now, day, {
    enforceWindow: true,
    windowMax: cfg.maxPerIpWindow,
    enforceDay: false,
    dayMax: 0,
    windowCode: 'rate/ip-window',
    dayCode: 'rate/ip-daily',
  });

  await bumpCounter(db.collection('multiIaRateLimits').doc('_global'), cfg, now, day, {
    enforceWindow: false,
    windowMax: 0,
    enforceDay: true,
    dayMax: cfg.globalMaxPerDay,
    windowCode: 'rate/global-window',
    dayCode: 'rate/global-daily',
  });

  return cfg;
}
