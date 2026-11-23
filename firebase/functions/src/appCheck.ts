import { getAppCheck } from 'firebase-admin/app-check';
import type { Request } from 'firebase-functions/v2/https';

/**
 * Optional App Check gate.
 * When `MULTI_IA_REQUIRE_APP_CHECK=1` (or true/yes), require a valid
 * `X-Firebase-AppCheck` token. Off by default so Lorenzo can deploy before
 * wiring App Check in the Expo client.
 */
export async function assertAppCheckIfRequired(req: Request): Promise<void> {
  const flag = (process.env.MULTI_IA_REQUIRE_APP_CHECK ?? '').trim().toLowerCase();
  const required = flag === '1' || flag === 'true' || flag === 'yes';
  if (!required) return;

  const token =
    req.get('X-Firebase-AppCheck') ?? req.get('x-firebase-appcheck') ?? '';
  if (!token.trim()) {
    const err = new Error('Missing App Check token');
    (err as Error & { status: number; code: string }).status = 401;
    (err as Error & { status: number; code: string }).code = 'appcheck/missing';
    throw err;
  }
  try {
    await getAppCheck().verifyToken(token.trim());
  } catch {
    const err = new Error('Invalid App Check token');
    (err as Error & { status: number; code: string }).status = 401;
    (err as Error & { status: number; code: string }).code = 'appcheck/invalid';
    throw err;
  }
}
