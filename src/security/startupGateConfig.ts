/**
 * Startup gate secret — local app constant only.
 * Do not document the value in README / public docs.
 * Optional override: EXPO_PUBLIC_APP_GATE_PASSWORD
 */
const fromEnv =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_APP_GATE_PASSWORD
    ? String(process.env.EXPO_PUBLIC_APP_GATE_PASSWORD)
    : '';

export const STARTUP_GATE_PASSWORD = fromEnv || 'Tarzane1234$';
