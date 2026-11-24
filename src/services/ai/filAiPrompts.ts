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

export type FilAiLang = 'fr' | 'en' | 'es';

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
const SUBJECT_PROMPTS: Record<FilAiSubject, Record<FilAiLang, string>> = {
  car: {
    fr: 'Tu es l’agent IA Urgence Mécanique sur le Fil. Sujet actif : VOITURE / SUV / pickup léger. Réponds seulement aux pannes, entretien, voyants et conduite auto. Phrases courtes. Si hors sujet, recentre sur la voiture.',
    en: 'You are the Urgence Mécanique Fil AI agent. Active subject: CAR / SUV / light pickup. Answer only car faults, maintenance, warning lights and driving. Short sentences. If off-topic, steer back to cars.',
    es: 'Eres el agente IA Urgence Mécanique en el Fil. Tema activo: COCHE / SUV / pickup ligero. Responde solo fallos, mantenimiento, testigos y conducción. Frases cortas. Si está fuera de tema, vuelve al coche.',
  },
  truck: {
    fr: 'Tu es l’agent IA Urgence Mécanique sur le Fil. Sujet actif : CAMION / poids lourd / semi. Réponds freins air, AdBlue, turbo, boîte, PTAC. Phrases courtes. Si hors sujet, recentre sur le camion.',
    en: 'You are the Urgence Mécanique Fil AI agent. Active subject: TRUCK / heavy duty / semi. Answer air brakes, DEF/AdBlue, turbo, gearbox, GVWR. Short sentences. If off-topic, steer back to trucks.',
    es: 'Eres el agente IA Urgence Mécanique en el Fil. Tema activo: CAMIÓN / pesado / semi. Responde frenos de aire, AdBlue, turbo, caja, PTAC. Frases cortas. Si está fuera de tema, vuelve al camión.',
  },
  parts: {
    fr: 'Tu es l’agent IA Urgence Mécanique sur le Fil. Sujet actif : PIÈCES & devis. Aide à identifier la pièce, références, anti-arnaque, ordre diag→pièce→réparation. Phrases courtes. Pas de hors-sujet shopping général.',
    en: 'You are the Urgence Mécanique Fil AI agent. Active subject: PARTS & quotes. Help name the part, refs, anti-scam, diag→part→repair order. Short sentences. No general shopping off-topic.',
    es: 'Eres el agente IA Urgence Mécanique en el Fil. Tema activo: PIEZAS y presupuestos. Ayuda a nombrar la pieza, referencias, anti-estafa, orden diag→pieza→reparación. Frases cortas. Sin compras generales fuera de tema.',
  },
  diagnostic: {
    fr: 'Tu es l’agent IA Urgence Mécanique sur le Fil. Sujet actif : DIAGNOSTIC. Pose 1 question utile si besoin, cite causes probables et pièces, oriente OBD / Multi-IA. Phrases courtes. Sécurité d’abord.',
    en: 'You are the Urgence Mécanique Fil AI agent. Active subject: DIAGNOSTIC. Ask 1 useful question if needed, list likely causes and parts, point to OBD / Multi-IA. Short sentences. Safety first.',
    es: 'Eres el agente IA Urgence Mécanique en el Fil. Tema activo: DIAGNÓSTICO. Haz 1 pregunta útil si hace falta, cita causas y piezas, orienta a OBD / Multi-IA. Frases cortas. Seguridad primero.',
  },
  truckers: {
    fr: 'Tu es l’agent IA Urgence Mécanique sur le Fil. Sujet actif : ROUTIERS. Aide HOS / pauses, pesage, dépôts, signalements, fatigue, itinéraires PL. Phrases courtes. Pas de conseils illégaux.',
    en: 'You are the Urgence Mécanique Fil AI agent. Active subject: TRUCKERS. Help with HOS / breaks, weigh stations, depots, hazards, fatigue, truck routes. Short sentences. No illegal advice.',
    es: 'Eres el agente IA Urgence Mécanique en el Fil. Tema activo: CAMIONEROS. Ayuda con HOS / pausas, básculas, depósitos, avisos, fatiga, rutas de camión. Frases cortas. Sin consejos ilegales.',
  },
};

export function pickFilAiLang(locale?: string): FilAiLang {
  const l = (locale ?? 'fr').toLowerCase();
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('es')) return 'es';
  return 'fr';
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
  const userLabel = lang === 'en' ? 'Driver' : lang === 'es' ? 'Conductor' : 'Conducteur';
  const agentLabel = lang === 'en' ? 'Agent' : 'Agent';
  const historyLines = history.map(
    (h) => `${h.role === 'user' ? userLabel : agentLabel}: ${h.text.slice(0, 220)}`,
  );

  const styleLine =
    lang === 'en'
      ? 'Reply style: short plain sentences, dyslexia-friendly, max ~6 sentences, in English.'
      : lang === 'es'
        ? 'Estilo de respuesta: frases cortas, legibles (dislexia), máx. ~6 frases, en español.'
        : 'Style réponse : phrases courtes, lisibles (dyslexie), max ~6 phrases, français clair.';

  const context = [
    `sujet=${opts.subject}`,
    subjectBlock,
    vehicleBits.length ? `véhicule: ${vehicleBits.join(' · ')}` : 'véhicule: aucun actif',
    historyLines.length ? `historique:\n${historyLines.join('\n')}` : null,
    styleLine,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt =
    lang === 'en'
      ? `[Fil AI · ${opts.subject}] ${message}`
      : lang === 'es'
        ? `[Agente Fil · ${opts.subject}] ${message}`
        : `[Agent Fil · ${opts.subject}] ${message}`;

  return { prompt, context };
}

function subjectLabel(s: FilAiSubject, lang: FilAiLang): string {
  const labels: Record<FilAiLang, Record<FilAiSubject, string>> = {
    fr: {
      car: 'voiture',
      truck: 'camion',
      parts: 'pièces',
      diagnostic: 'diagnostic',
      truckers: 'routiers',
    },
    en: {
      car: 'car',
      truck: 'truck',
      parts: 'parts',
      diagnostic: 'diagnostic',
      truckers: 'truckers',
    },
    es: {
      car: 'coche',
      truck: 'camión',
      parts: 'piezas',
      diagnostic: 'diagnóstico',
      truckers: 'camioneros',
    },
  };
  return labels[lang][s];
}

/** Turn Multi-IA consensus into a short chat reply. */
export function formatFilAiReply(
  result: FilAiConsensusInput,
  subject: FilAiSubject,
  locale?: string,
): string {
  const lang = pickFilAiLang(locale);
  if (!result.ok || !result.consensus.trim()) {
    if (lang === 'en') {
      return 'I could not answer yet. Try again with more detail about the vehicle or the symptom.';
    }
    if (lang === 'es') {
      return 'No pude responder aún. Inténtelo de nuevo con más detalle sobre el vehículo o el síntoma.';
    }
    return 'Je n’ai pas pu répondre. Réessayez avec plus de détail sur le véhicule ou le symptôme.';
  }

  const parts =
    result.likelyParts.length > 0
      ? lang === 'en'
        ? `Likely parts: ${result.likelyParts.slice(0, 4).join(', ')}.`
        : lang === 'es'
          ? `Piezas probables: ${result.likelyParts.slice(0, 4).join(', ')}.`
          : `Pièces probables : ${result.likelyParts.slice(0, 4).join(', ')}.`
      : null;

  const severityLine =
    result.severity === 'critique'
      ? lang === 'en'
        ? 'Severity: critical — stop safely if needed.'
        : lang === 'es'
          ? 'Gravedad: crítica — deténgase con seguridad si hace falta.'
          : 'Gravité : critique — arrêtez-vous en sécurité si besoin.'
      : result.severity === 'warn'
        ? lang === 'en'
          ? 'Severity: warning — check soon.'
          : lang === 'es'
            ? 'Gravedad: atención — revise pronto.'
            : 'Gravité : attention — vérifiez bientôt.'
        : null;

  const subjectHint =
    lang === 'en'
      ? `Topic: ${subjectLabel(subject, lang)}.`
      : lang === 'es'
        ? `Tema: ${subjectLabel(subject, lang)}.`
        : `Sujet : ${subjectLabel(subject, lang)}.`;

  const core = result.consensus
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);

  return [subjectHint, core, parts, severityLine].filter(Boolean).join('\n\n');
}

export function emptyFilAiQuestionReply(locale?: string): string {
  const lang = pickFilAiLang(locale);
  if (lang === 'en') return 'Type a short question for the AI agent.';
  if (lang === 'es') return 'Escriba una pregunta corta para el agente IA.';
  return 'Écrivez une question courte pour l’agent IA.';
}
