/**
 * Couche stub explicite — aucun appel live VIN / OBD / IA / paiement / météo.
 * Remplacer ces fonctions par de vrais clients API plus tard.
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

/** @deprecated Prefer `runMultiIaDiagnostic` from `services/ai/multiIaRouter`. */
export function stubAiDiagnose(prompt: string): StubResult<{ summary: string; models: string[] }> {
  return {
    ok: true,
    data: {
      summary: `Délègue au routeur Multi-IA pour « ${prompt.slice(0, 80)} » — utiliser runMultiIaDiagnostic.`,
      models: ['Claude', 'Gemini', 'GPT-4o', 'Grok', 'Mistral', 'DeepSeek'],
    },
    stub: true,
    label: 'Multi-IA — utiliser runMultiIaDiagnostic (heuristique + live optionnel)',
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
    data: { guess: 'Bruit simulé : possible roulement / courroie (micro non utilisé).' },
    stub: true,
    label: 'STUB IA — analyseur acoustique moteur non branché',
  };
}

export function stubOtaSync(): StubResult<{ lastSync: string; learnedFailures: number }> {
  return {
    ok: true,
    data: { lastSync: new Date().toISOString(), learnedFailures: 3 },
    stub: true,
    label: 'STUB — bases OTA / auto-apprentissage non branchés au cloud',
  };
}
