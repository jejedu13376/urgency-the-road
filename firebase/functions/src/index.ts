import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { assertAppCheckIfRequired } from './appCheck';
import { requireFirebaseUser } from './auth';
import { parseProxyBody } from './parse';
import { ALL_ENGINES } from './types';
import { configuredEngines, runProvider } from './providers';
import { assertWithinRateLimit } from './rateLimit';
import { BOUND_SECRETS } from './secrets';
import type { ProxyErrorBody } from './types';

initializeApp();

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 20,
  timeoutSeconds: 30,
  memory: '256MiB',
});

function applyCors(
  res: { set: (k: string, v: string) => void },
  origin: string | undefined,
) {
  const allow = (process.env.MULTI_IA_CORS_ORIGIN ?? '*').trim() || '*';
  if (allow === '*') {
    res.set('Access-Control-Allow-Origin', '*');
  } else if (origin && allow.split(',').map((s) => s.trim()).includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  } else {
    res.set('Access-Control-Allow-Origin', allow.split(',')[0]!.trim());
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Requested-With, X-Firebase-AppCheck',
  );
  res.set('Access-Control-Max-Age', '3600');
}

function sendError(
  res: {
    status: (n: number) => { json: (b: ProxyErrorBody) => void };
    setHeader?: (k: string, v: string) => void;
  },
  status: number,
  code: string,
  error: string,
  engine?: ProxyErrorBody['engine'],
  retryAfterSec?: number,
) {
  if (retryAfterSec != null && typeof res.setHeader === 'function') {
    res.setHeader('Retry-After', String(retryAfterSec));
  }
  res.status(status).json({ error, code, ...(engine ? { engine } : {}) });
}

/** Map internal errors → safe client strings (never provider bodies / key material). */
function clientSafeMessage(code: unknown, status: number): string {
  const c = typeof code === 'string' ? code : '';
  if (c.startsWith('auth/')) return 'Authentication required';
  if (c.startsWith('appcheck/')) return 'App Check required';
  if (c.startsWith('rate/')) return 'Rate limit exceeded';
  if (c.startsWith('bad-request/')) return 'Invalid request';
  if (c.startsWith('provider/') || status === 502 || status === 504) {
    return 'Engine request failed';
  }
  if (status === 503) return 'Engine unavailable';
  if (status === 429) return 'Rate limit exceeded';
  return 'Internal error';
}

/**
 * Trusted client IP for rate keys.
 * Do NOT use Express `req.ip` under Functions Framework `trust proxy` — that is the
 * leftmost XFF hop (client-spoofable). Prefer socket peer, else rightmost XFF only.
 */
function clientIp(req: {
  get: (h: string) => string | undefined;
  socket?: { remoteAddress?: string };
  rawRequest?: { socket?: { remoteAddress?: string } };
}): string {
  const remote =
    req.socket?.remoteAddress?.trim() ||
    req.rawRequest?.socket?.remoteAddress?.trim() ||
    '';
  if (remote) return remote;
  const hops = (req.get('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (hops.length) return hops[hops.length - 1]!;
  return 'unknown';
}

/**
 * Multi-IA proxy — POST JSON `{ engine, prompt, context }`
 * Auth: Firebase ID token (email_verified); App Check opt-in via MULTI_IA_REQUIRE_APP_CHECK=1
 * Spend: per-UID + per-IP window + project-wide daily cap
 * Client env: `EXPO_PUBLIC_MULTI_IA_PROXY_URL`
 *
 * See docs/MULTI-IA-PROXY.md
 */
export const multiIa = onRequest(
  {
    cors: false,
    invoker: 'public', // auth (+ optional App Check) verified in-handler
    secrets: BOUND_SECRETS,
  },
  async (req, res) => {
    applyCors(res, req.get('origin') ?? undefined);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method === 'GET') {
      // Public health — never disclose which paid engines have keys.
      const publicBody = {
        ok: true,
        service: 'urgency-road-multi-ia-proxy',
        engines: [...ALL_ENGINES],
        auth: 'Bearer Firebase ID token (email verified) required on POST',
      };
      // Authenticated GET may include configured engine names (ops only).
      try {
        await requireFirebaseUser(req);
        res.status(200).json({
          ...publicBody,
          enginesConfigured: configuredEngines(),
        });
      } catch {
        res.status(200).json(publicBody);
      }
      return;
    }

    if (req.method !== 'POST') {
      sendError(res, 405, 'method-not-allowed', 'Use POST');
      return;
    }

    try {
      await assertAppCheckIfRequired(req);
      const caller = await requireFirebaseUser(req);
      await assertWithinRateLimit(caller.uid, clientIp(req));
      const { engine, prompt, context } = parseProxyBody(req.body);
      const result = await runProvider(engine, prompt, context);
      res.status(200).json(result);
    } catch (e) {
      const err = e as Error & {
        status?: number;
        code?: unknown;
        name?: string;
        retryAfterSec?: number;
      };
      const aborted =
        err.name === 'AbortError' ||
        (typeof DOMException !== 'undefined' && e instanceof DOMException);
      const status =
        typeof err.status === 'number' ? err.status : aborted ? 504 : 500;
      const code =
        typeof err.code === 'string' && err.code.length > 0
          ? err.code
          : aborted
            ? 'provider/timeout'
            : 'internal';
      console.error(`[multiIa] code=${code} status=${status}`);
      sendError(
        res,
        status,
        code,
        clientSafeMessage(code, status),
        undefined,
        err.retryAfterSec,
      );
    }
  },
);
