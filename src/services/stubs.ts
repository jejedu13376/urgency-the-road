/**
 * Couche stub / labels honnêtes pour écrans encore partiels.
 * Live paths live elsewhere: NHTSA VIN, Open-Meteo, Multi-IA proxy, Overpass, YouTube.
 * Keep these helpers for sync UI copy and unpaid / hardware-blocked flows.
 */

export type StubResult<T> = {
  ok: true;
  data: T;
  stub: true;
  label: string;
};

export function stubVinDecodeLabel() {
  return 'VIN — NHTSA vPIC live ; fallback WMI local si réseau KO';
}

export function stubObdConnect(): StubResult<{ connected: false; protocol: string }> {
  return {
    ok: true,
    data: { connected: false, protocol: 'OBD2/J1939 (non branché)' },
    stub: true,
    label: 'STUB OBD — pas de liaison Bluetooth/USB réelle',
  };
}

/**
 * User-facing local diagnostic summary (sync). Prefer `runMultiIaDiagnostic` for
 * full multi-engine routing when async is available.
 */
export function stubAiDiagnose(prompt: string): StubResult<{ summary: string; models: string[] }> {
  const clipped = prompt.trim().slice(0, 100) || 'panne';
  return {
    ok: true,
    data: {
      summary: `Analyse locale pour « ${clipped} » — croisement multi-moteurs (heuristique). Vérifiez freins, bruits, voyants et consultez le catalogue pièces / OBD.`,
      models: ['Claude', 'Gemini', 'GPT-4o', 'Grok', 'Mistral', 'DeepSeek'],
    },
    stub: true,
    label: 'Diagnostic local (heuristique) — Multi-IA async disponible sur description libre',
  };
}

export function stubPayment(planId: string): StubResult<{ checkoutUrl: null; planId: string }> {
  return {
    ok: true,
    data: { checkoutUrl: null, planId },
    stub: true,
    label: 'STUB paiement — Stripe/PayPal/wallets (pas de Lydia) ; bases checkout .env',
  };
}

/** @deprecated Prefer `fetchWeather` from `services/weather/openMeteo`. */
export function stubWeather(): StubResult<{
  tempC: number;
  road: 'ouvertes' | 'fermees' | 'glacees';
  updatedAt: string;
}> {
  return {
    ok: true,
    data: {
      tempC: 8,
      road: 'ouvertes',
      updatedAt: new Date().toISOString(),
    },
    stub: true,
    label: 'Météo — utiliser fetchWeather (Open-Meteo live)',
  };
}

export function stubQuoteScan(): StubResult<{ overchargeRisk: 'faible' | 'moyen' | 'eleve'; note: string }> {
  return {
    ok: true,
    data: {
      overchargeRisk: 'moyen',
      note: 'Heuristique marché local — OCR ML Kit / Document AI à brancher.',
    },
    stub: true,
    label: 'STUB OCR devis — analyse structurée locale (pas d’OCR image encore)',
  };
}

export function stubAcoustic(): StubResult<{ guess: string }> {
  return {
    ok: true,
    data: {
      guess:
        'Micro non capturé — aucune classification audio. Décrivez le bruit (courroie / injecteur / bielle / roulement) dans le diagnostic libre.',
    },
    stub: true,
    label: 'STUB acoustique — pas d’enregistrement micro ; aucun diagnostic son inventé',
  };
}

export function stubOtaSync(): StubResult<{ lastSync: string; learnedFailures: number }> {
  return {
    ok: true,
    data: { lastSync: new Date().toISOString(), learnedFailures: 0 },
    stub: true,
    label: 'OTA EAS Update non configuré — aucune sync cloud simulée',
  };
}
