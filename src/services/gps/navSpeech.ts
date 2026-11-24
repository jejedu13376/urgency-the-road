/**
 * Turn-by-turn TTS via app speech — mute/unmute + upcoming turn / ETA phrases.
 * Phrases follow the active FR/EN/ES locale; mute is shared app-wide (GPS side rail).
 */
import { t } from '../../i18n';
import {
  isAppSpeechMutedSync,
  loadAppSpeechMuted,
  setAppSpeechMuted,
  speakApp,
  stopAppSpeech,
} from '../speech/appSpeech';

export const loadNavSpeechMuted = loadAppSpeechMuted;
export const setNavSpeechMuted = setAppSpeechMuted;
export const isNavSpeechMutedSync = isAppSpeechMutedSync;
export const stopNavSpeech = stopAppSpeech;

export function speakNav(text: string, opts?: { force?: boolean; language?: string }): void {
  speakApp(text, {
    force: opts?.force,
    language: opts?.language,
    maxLen: 280,
  });
}

export function formatDistanceSpoken(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const m = Math.max(10, Math.round((km * 1000) / 10) * 10);
    return t('tts.meters', { m });
  }
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return t('tts.kilometers', { km: rounded });
}

/** @deprecated Prefer formatDistanceSpoken — kept for callers/tests expecting FR-only helper name. */
export function formatDistanceFr(km: number): string {
  return formatDistanceSpoken(km);
}

export function speakUpcomingTurn(instruction: string, distanceKm: number): void {
  const dist = formatDistanceSpoken(distanceKm);
  const clean = instruction.replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!clean) return;
  speakNav(dist ? t('tts.upcomingTurn', { distance: dist, instruction: clean }) : clean);
}

export function speakArrival(durationMin?: number, distanceKm?: number): void {
  const bits: string[] = [t('tts.arrival')];
  if (typeof durationMin === 'number' && durationMin > 0) {
    bits.push(t('tts.arrivalEta', { minutes: Math.round(durationMin) }));
  }
  if (typeof distanceKm === 'number' && distanceKm > 0) {
    bits.push(formatDistanceSpoken(distanceKm));
  }
  speakNav(bits.join(', '));
}

export function speakWeighAlert(distanceKm: number, name?: string): void {
  const dist = formatDistanceSpoken(distanceKm);
  const label = name ? t('tts.weighNamed', { name }) : t('tts.weighDefault');
  speakNav(dist ? t('tts.weighAlert', { label, distance: dist }) : t('tts.weighNear', { label }));
}

export function speakNavStarted(opts: {
  mode: 'voiture' | 'camion';
  distanceKm: number;
  durationMin: number;
}): void {
  const distance = Math.round(opts.distanceKm * 10) / 10;
  const minutes = Math.round(opts.durationMin);
  speakNav(
    opts.mode === 'camion'
      ? t('tts.navStartedTruck', { distance, minutes })
      : t('tts.navStartedCar', { distance, minutes }),
  );
}
