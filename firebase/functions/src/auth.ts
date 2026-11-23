import { getAuth } from 'firebase-admin/auth';
import type { Request } from 'firebase-functions/v2/https';

export type VerifiedCaller = {
  uid: string;
  email?: string;
  emailVerified: boolean;
};

function requireEmailVerified(): boolean {
  // Default ON — free unverified signups must not burn LLM keys.
  // Set MULTI_IA_ALLOW_UNVERIFIED_EMAIL=1 only for local/emulator testing.
  const allow = (process.env.MULTI_IA_ALLOW_UNVERIFIED_EMAIL ?? '')
    .trim()
    .toLowerCase();
  if (allow === '1' || allow === 'true' || allow === 'yes') return false;
  return true;
}

/**
 * Require `Authorization: Bearer <Firebase ID token>`.
 * Live LLM spend must never be anonymous.
 * By default also requires `email_verified` on the token.
 */
export async function requireFirebaseUser(req: Request): Promise<VerifiedCaller> {
  const header = req.get('authorization') ?? req.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) {
    const err = new Error('Missing Authorization Bearer token');
    (err as Error & { status: number; code: string }).status = 401;
    (err as Error & { status: number; code: string }).code = 'auth/missing-token';
    throw err;
  }
  try {
    const decoded = await getAuth().verifyIdToken(match[1], true);
    const emailVerified = Boolean(decoded.email_verified);
    if (requireEmailVerified() && !emailVerified) {
      const err = new Error('Email verification required');
      (err as Error & { status: number; code: string }).status = 401;
      (err as Error & { status: number; code: string }).code = 'auth/email-unverified';
      throw err;
    }
    return { uid: decoded.uid, email: decoded.email, emailVerified };
  } catch (e) {
    const existing = e as Error & { status?: number; code?: string };
    if (existing.code === 'auth/email-unverified') throw e;
    const err = new Error('Invalid or expired Firebase ID token');
    (err as Error & { status: number; code: string }).status = 401;
    (err as Error & { status: number; code: string }).code = 'auth/invalid-token';
    throw err;
  }
}
