import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { requireFirebaseUser } from './auth';
import { parseProxyBody } from './parse';
import { configuredEngines, runProvider } from './providers';
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
    'Authorization, Content-Type, X-Requested-With',
  );
  res.set('Access-Control-Max-Age', '3600');
}

function sendError(
  res: {
    status: (n: number) => { json: (b: ProxyErrorBody) => void };
  },
  status: number,
  code: string,
  error: string,
  engine?: ProxyErrorBody['engine'],
) {
  res.status(status).json({ error, code, ...(engine ? { engine } : {}) });
}

/**
 * Multi-IA proxy — POST JSON `{ engine, prompt, context }`
 * Auth: `Authorization: Bearer <Firebase ID token>` (required)
 * Client env: `EXPO_PUBLIC_MULTI_IA_PROXY_URL` → this function URL
 *
 * Provider keys from process.env / Secret Manager (never EXPO_PUBLIC_*).
 * See docs/MULTI-IA-PROXY.md for deploy + exact secret names.
 */
export const multiIa = onRequest(
  {
    cors: false,
    invoker: 'public', // Firebase ID token verified in-handler
    secrets: BOUND_SECRETS,
  },
  async (req, res) => {
    applyCors(res, req.get('origin') ?? undefined);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method === 'GET') {
      res.status(200).json({
        ok: true,
        service: 'urgency-road-multi-ia-proxy',
        enginesConfigured: configuredEngines(),
        auth: 'Bearer Firebase ID token required on POST',
      });
      return;
    }

    if (req.method !== 'POST') {
      sendError(res, 405, 'method-not-allowed', 'Use POST');
      return;
    }

    try {
      await requireFirebaseUser(req);
      const { engine, prompt, context } = parseProxyBody(req.body);
      const result = await runProvider(engine, prompt, context);
      res.status(200).json(result);
    } catch (e) {
      const err = e as Error & { status?: number; code?: string };
      const status = typeof err.status === 'number' ? err.status : 500;
      const code = err.code ?? 'internal';
      const message = err.message || 'Internal error';
      console.error(`[multiIa] ${code}: ${message}`);
      sendError(res, status, code, message);
    }
  },
);
