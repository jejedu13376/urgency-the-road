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
  return 'STUB VIN — décodage local mock, pas d’API constructeur live';
}

export function stubObdConnect(): StubResult<{ connected: false; protocol: string }> {
  return {
    ok: true,
    data: { connected: false, protocol: 'OBD2/J1939 (non branché)' },
    stub: true,
    label: 'STUB OBD — pas de liaison Bluetooth/USB réelle',
  };
}

export function stubAiDiagnose(prompt: string): StubResult<{ summary: string; models: string[] }> {
  return {
    ok: true,
    data: {
      summary: `Analyse mock pour « ${prompt.slice(0, 80)} » — croisement multi-IA non connecté.`,
      models: ['Claude*', 'Gemini*', 'GPT-4o*', 'Grok*', 'Mistral*', 'DeepSeek*'],
    },
    stub: true,
    label: 'STUB IA — réponses mock, pas de Claude/GPT/Gemini live',
  };
}

export function stubPayment(planId: string): StubResult<{ checkoutUrl: null; planId: string }> {
  return {
    ok: true,
    data: { checkoutUrl: null, planId },
    stub: true,
    label: 'STUB paiement — Lydia/Stripe/Apple Pay/Google Pay non branchés',
  };
}

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
    label: 'STUB météo — valeurs locales mock',
  };
}

export function stubQuoteScan(): StubResult<{ overchargeRisk: 'faible' | 'moyen' | 'eleve'; note: string }> {
  return {
    ok: true,
    data: {
      overchargeRisk: 'moyen',
      note: 'Comparaison mock vs marché local — OCR/IA devis non branchés.',
    },
    stub: true,
    label: 'STUB IA — scanner de devis garage (photo/PDF) non branché',
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
