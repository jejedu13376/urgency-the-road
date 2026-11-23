/**
 * Startup gate — seller-demo only.
 *
 * Never hardcode a password in source. Set EXPO_PUBLIC_APP_GATE_PASSWORD in
 * local `.env` / EAS secrets for demos. That value is still embedded in the
 * client bundle at build time (not a server secret) — rotate if it was ever
 * committed as plaintext, and treat it as light friction only.
 *
 * When unset/empty: gate is disabled (auto-unlock).
 */
const raw =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_APP_GATE_PASSWORD
    ? String(process.env.EXPO_PUBLIC_APP_GATE_PASSWORD).trim()
    : '';

/** Non-empty password from env, or empty string when gate is off. */
export const STARTUP_GATE_PASSWORD = raw;

/** True when a gate password was configured for this build. */
export const STARTUP_GATE_ENABLED = STARTUP_GATE_PASSWORD.length > 0;
