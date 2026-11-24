/**
 * Pure Fil AI prompt/context helpers (no Firebase / Multi-IA imports).
 * Used by filAiAgent and unit tests.
 */

import type { VehicleProfile } from '../../types/vehicle';

/** Minimal shape needed to format a chat reply (avoids importing Multi-IA runtime). */
export type FilAiConsensusInput = {
  ok: boolean;
  consensus: string;
  likelyParts: string[];
  severity: 'info' | 'warn' | 'critique';
};

export type FilAiSubject = 'car' | 'truck' | 'parts' | 'diagnostic' | 'truckers';

export const FIL_AI_SUBJECTS: FilAiSubject[] = [
  'car',
  'truck',
  'parts',
  'diagnostic',
  'truckers',
];

export type FilAiChatTurn = {
  role: 'user' | 'assistant';
  text: string;
};

/** Subject system prompts — keep the agent on-topic for the Fil chat. */
const SUBJECT_PROMPTS: Record<FilAiSubject, { fr: string; en: string }> = {
  car: {
    fr: 'Tu es l’agent IA Urgence Mécanique sur le Fil. Sujet actif : VOITURE / SUV / pickup léger. Réponds seulement aux pannes, entretien, voyants et conduite auto. Phrases courtes. Si hors sujet, recentre sur la voiture.',
    en: 'You are the Urgence Mécanique Fil AI agent. Active subject: CAR / SUV / light pickup. Answer only car faults, maintenance, warning lights and driving. Short sentences. If off-topic, steer back to cars.',
  },
  truck: {
    fr: 'Tu es l’agent IA Urgence Mécanique sur le Fil. Sujet actif : CAMION / poids lourd / semi. Réponds freins air, AdBlue, turbo, boîte, PTAC. Phrases courtes. Si hors sujet, recentre sur le camion.',
    en: 'You are the Urgence Mécanique Fil AI agent. Active subject: TRUCK / heavy duty / semi. Answer air brakes, DEF/AdBlue, turbo, gearbox, GVWR. Short sentences. If off-topic, steer back to trucks.',
  },
  parts: {
    fr: 'Tu es l’agent IA Urgence Mécanique sur le Fil. Sujet actif : PIÈCES & devis. Aide à identifier la pièce, références, anti-arnaque, ordre diag→pièce→réparation. Phrases courtes. Pas de hors-sujet shopping général.',
    en: 'You are the Urgence Mécanique Fil AI agent. Active subject: PARTS & quotes. Help name the part, refs, anti-scam, diag→part→repair order. Short sentences. No general shopping off-topic.',
  },
  diagnostic: {
    fr: 'Tu es l’agent IA Urgence Mécanique sur le Fil. Sujet actif : DIAGNOSTIC. Pose 1 question utile si besoin, cite causes probables et pièces, oriente OBD / Multi-IA. Phrases courtes. Sécurité d’abord.',
    en: 'You are the Urgence Mécanique Fil AI agent. Active subject: DIAGNOSTIC. Ask 1 useful question if needed, list likely causes and parts, point to OBD / Multi-IA. Short sentences. Safety first.',
  },
  truckers: {
    fr: 'Tu es l’agent IA Urgence Mécanique sur le Fil. Sujet actif : ROUTIERS. Aide HOS / pauses, pesage, dépôts, signalements, fatigue, itinéraires PL. Phrases courtes. Pas de conseils illégaux.',
    en: 'You are the Urgence Mécanique Fil AI agent. Active subject: TRUCKERS. Help with HOS / breaks, weigh stations, depots, hazards, fatigue, truck routes. Short sentences. No illegal advice.',
  },
};

export function pickFilAiLang(locale?: string): 'fr' | 'en' {
  const l = (locale ?? 'fr').toLowerCase();
  return l.startsWith('en') ? 'en' : 'fr';
}

/** Builds the Multi-IA prompt + context strings for the Fil agent. */
export function buildFilAiPrompt(opts: {
  message: string;
  subject: FilAiSubject;
  vehicle?: VehicleProfile | null;
  history?: FilAiChatTurn[];
  locale?: string;
}): { prompt: string; context: string } {
  const lang = pickFilAiLang(opts.locale);
  const subjectBlock = SUBJECT_PROMPTS[opts.subject][lang];
  const message = opts.message.trim();

  const vehicleBits: string[] = [];
  const v = opts.vehicle;
  if (v) {
    vehicleBits.push(
      `${v.make} ${v.model} ${v.year}`,
      `classe=${v.vehicleClass}`,
      `motorisation=${v.powertrain}`,
      v.vin ? `VIN=${v.vin}` : 'sans VIN',
      `odomètre=${v.odometerKm} km`,
    );
  }

  const history = (opts.history ?? []).slice(-6);
  const historyLines = history.map(
    (h) => `${h.role === 'user' ? 'Conducteur' : 'Agent'}: ${h.text.slice(0, 220)}`,
  );

  const context = [
    `sujet=${opts.subject}`,
    subjectBlock,
    vehicleBits.length ? `véhicule: ${vehicleBits.join(' · ')}` : 'véhicule: aucun actif',
    historyLines.length ? `historique:\n${historyLines.join('\n')}` : null,
    lang === 'en'
      ? 'Reply style: short plain sentences, dyslexia-friendly, max ~6 sentences, French product tone OK if locale fr.'
      : 'Style réponse : phrases courtes, lisibles (dyslexie), max ~6 phrases, français clair.',
  ]
    .filter(Boolean)
    .join('\n');

  const prompt =
    lang === 'en'
      ? `[Fil AI · ${opts.subject}] ${message}`
      : `[Agent Fil · ${opts.subject}] ${message}`;

  return { prompt, context };
}

function subjectLabelFr(s: FilAiSubject): string {
  switch (s) {
    case 'car':
      return 'voiture';
    case 'truck':
      return 'camion';
    case 'parts':
      return 'pièces';
    case 'diagnostic':
      return 'diagnostic';
    case 'truckers':
      return 'routiers';
  }
}

/** Turn Multi-IA consensus into a short chat reply. */
export function formatFilAiReply(
  result: FilAiConsensusInput,
  subject: FilAiSubject,
  locale?: string,
): string {
  const lang = pickFilAiLang(locale);
  if (!result.ok || !result.consensus.trim()) {
    return lang === 'en'
      ? 'I could not answer yet. Try again with more detail about the vehicle or the symptom.'
      : 'Je n’ai pas pu répondre. Réessayez avec plus de détail sur le véhicule ou le symptôme.';
  }

  const parts =
    result.likelyParts.length > 0
      ? lang === 'en'
        ? `Likely parts: ${result.likelyParts.slice(0, 4).join(', ')}.`
        : `Pièces probables : ${result.likelyParts.slice(0, 4).join(', ')}.`
      : null;

  const severityLine =
    result.severity === 'critique'
      ? lang === 'en'
        ? 'Severity: critical — stop safely if needed.'
        : 'Gravité : critique — arrêtez-vous en sécurité si besoin.'
      : result.severity === 'warn'
        ? lang === 'en'
          ? 'Severity: warning — check soon.'
          : 'Gravité : attention — vérifiez bientôt.'
        : null;

  const subjectHint =
    lang === 'en'
      ? `Topic: ${subject}.`
      : `Sujet : ${subjectLabelFr(subject)}.`;

  const core = result.consensus
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);

  return [subjectHint, core, parts, severityLine].filter(Boolean).join('\n\n');
}
