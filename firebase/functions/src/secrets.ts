/**
 * Optional provider secrets (Secret Manager).
 *
 * Default `BOUND_SECRETS` is empty so `firebase deploy` works before keys exist.
 * Engines without keys return HTTP 503; the app falls back to heuristics.
 *
 * When ready, either:
 * A) Cloud Console → Cloud Functions → multiIa → Runtime → add env vars / secrets
 *    (names in SECRET_NAMES) — no code change.
 * B) `firebase functions:secrets:set <NAME>` then:
 *      import { defineSecret } from 'firebase-functions/params';
 *      const openai = defineSecret('OPENAI_API_KEY');
 *      export const BOUND_SECRETS = [openai];
 *    and redeploy.
 *
 * See docs/MULTI-IA-PROXY.md
 */

/** Exact secret / env names Lorenzo must set (values never in git). */
export const SECRET_NAMES = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'XAI_API_KEY',
  'MISTRAL_API_KEY',
  'DEEPSEEK_API_KEY',
] as const;

/**
 * Mounted onto the function at deploy time via `onRequest({ secrets })`.
 * Keep empty until Secret Manager entries exist (Console env vars need no bind).
 */
export const BOUND_SECRETS: string[] = [];
