/**
 * Module 4 — microphone capture + metering heuristic (free / on-device).
 * Records a short sample via expo-audio; classifies signal level only.
 * Does NOT run ML / spectral diagnosis — focus tags guide the copy.
 */

export type AcousticFocus = 'courroie' | 'injecteur' | 'bielle' | 'roulement';

export type AcousticSignal = 'silence' | 'low' | 'present' | 'strong';

export type AcousticAnalysis = {
  signal: AcousticSignal;
  durationMs: number;
  peakMeteringDb: number | null;
  focus: AcousticFocus | null;
  guess: string;
  label: string;
};

const FOCUS_HINT: Record<AcousticFocus, string> = {
  courroie:
    'Piste courroie / galet : sifflement aigu variable avec le régime — vérifier tension et galets tendeurs.',
  injecteur:
    'Piste injecteur : cliquetis rythmique au ralenti — contrôler rail / injecteurs (OBD M5 utile).',
  bielle:
    'Piste bielle : cognement sourd bas régime sous charge — arrêt conseillé, confirmer via OBD / garage.',
  roulement:
    'Piste roulement : grondement proportionnel à la vitesse — tester en virage (gauche/droite).',
};

/**
 * Metering from expo-audio is typically dBFS (~ -160 … 0).
 * Thresholds are conservative — silence stays silence (no fake diagnosis).
 */
export function analyzeAcousticCapture(opts: {
  durationMs: number;
  peakMeteringDb?: number | null;
  focus?: AcousticFocus | null;
}): AcousticAnalysis {
  const durationMs = Math.max(0, Math.round(opts.durationMs));
  const peak =
    typeof opts.peakMeteringDb === 'number' && Number.isFinite(opts.peakMeteringDb)
      ? opts.peakMeteringDb
      : null;
  const focus = opts.focus ?? null;

  let signal: AcousticSignal = 'silence';
  if (peak == null) {
    signal = durationMs >= 800 ? 'low' : 'silence';
  } else if (peak < -55) {
    signal = 'silence';
  } else if (peak < -35) {
    signal = 'low';
  } else if (peak < -18) {
    signal = 'present';
  } else {
    signal = 'strong';
  }

  const focusBit = focus
    ? FOCUS_HINT[focus]
    : 'Aucune piste sélectionnée — choisissez courroie / injecteur / bielle / roulement pour cadrer le suivi.';

  let levelBit: string;
  if (signal === 'silence') {
    levelBit =
      'Signal micro trop faible ou silencieux — rapprochez le téléphone du moteur (capot ouvert, sécurité).';
  } else if (signal === 'low') {
    levelBit = 'Signal micro faible capturé — enregistrement OK, classification ML non branchée.';
  } else if (signal === 'present') {
    levelBit = 'Signal micro présent — niveaux utiles pour un suivi manuel / Multi-IA texte.';
  } else {
    levelBit = 'Signal micro fort — évitez la saturation ; réessayez un peu plus loin du bloc.';
  }

  const meteringBit =
    peak == null
      ? 'Metering indisponible sur cette plateforme — durée seule utilisée.'
      : `Pic metering ≈ ${peak.toFixed(1)} dBFS · ${durationMs} ms.`;

  return {
    signal,
    durationMs,
    peakMeteringDb: peak,
    focus,
    guess: `${levelBit}\n${meteringBit}\n${focusBit}\nPas de classification spectrale ML — confirmez via description libre / OBD / garage.`,
    label: `Micro LIVE · signal ${signal} · heuristique metering (pas de ML audio)`,
  };
}

export const MIC_AUDIO_LIVE =
  'Micro LIVE (expo-audio) — capture + metering heuristique ; pas de classification ML spectrale.';

/** Vision lite LIVE — paid CV model remains an external option. */
export { VISION_PIXELS_LIVE, VISION_PIXELS_BLOCKED } from './visionPixelsLite';
