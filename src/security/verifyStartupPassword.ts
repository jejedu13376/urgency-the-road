import { STARTUP_GATE_ENABLED, STARTUP_GATE_PASSWORD } from './startupGateConfig';

/** Password check — compare input to env-configured constant only (no hardcoded default). */
export function verifyStartupPassword(input: string): boolean {
  if (!STARTUP_GATE_ENABLED) return true;
  return input === STARTUP_GATE_PASSWORD;
}
