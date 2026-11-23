import { getAppCheck } from 'firebase-admin/app-check';
import type { Request } from 'firebase-functions/v2/https';

/**
 * App Check gate.
 *
 * Production default: **required** when not running in the Functions emulator
 * (`FUNCTIONS_EMULATOR` unset). Override with:
 * - `MULTI_IA_REQUIRE_APP_CHECK=0` to disable (not recommended in prod)
 * - `MULTI_IA_REQUIRE_APP_CHECK=1` to force on (including emulator)
 *
 * Client must send `X-Firebase-AppCheck` once App Check is wired in Expo.
 * Until then, keep email_verified + rate/global caps (see auth.ts / rateLimit.ts).
 */
export async function assertAppCheckIfRequired(req: Request): Promise<void> {
  const flag = (process.env.MULTI_IA_REQUIRE_APP_CHECK ?? '').trim().toLowerCase();
  const inEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  let required: boolean;
  if (flag === '0' || flag === 'false' || flag === 'no') {
    required = false;
  } else if (flag === '1' || flag === 'true' || flag === 'yes') {
    required = true;
  } else {
    // Unset → required outside emulator
    required = !inEmulator;
  }
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
