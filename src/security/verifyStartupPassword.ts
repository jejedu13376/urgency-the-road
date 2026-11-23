import { STARTUP_GATE_PASSWORD } from './startupGateConfig';

/** Password check lives here — compare input to local/env constant. */
export function verifyStartupPassword(input: string): boolean {
  return input === STARTUP_GATE_PASSWORD;
}
