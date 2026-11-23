import { getAuth } from 'firebase-admin/auth';
import type { Request } from 'firebase-functions/v2/https';

export type VerifiedCaller = {
  uid: string;
  email?: string;
};

/**
 * Require `Authorization: Bearer <Firebase ID token>`.
 * Live LLM spend must never be anonymous.
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
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    const err = new Error('Invalid or expired Firebase ID token');
    (err as Error & { status: number; code: string }).status = 401;
    (err as Error & { status: number; code: string }).code = 'auth/invalid-token';
    throw err;
  }
}
