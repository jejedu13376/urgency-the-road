/**
 * Turn-by-turn TTS via expo-speech — mute/unmute + upcoming turn / ETA phrases.
 */
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MUTE_KEY = 'um.gps.nav.speech.muted.v1';

let mutedMemory = false;
let muteLoaded = false;

export async function loadNavSpeechMuted(): Promise<boolean> {
  if (muteLoaded) return mutedMemory;
  try {
    const raw = await AsyncStorage.getItem(MUTE_KEY);
    mutedMemory = raw === '1';
  } catch {
    mutedMemory = false;
  }
  muteLoaded = true;
  return mutedMemory;
}

export async function setNavSpeechMuted(muted: boolean): Promise<void> {
  mutedMemory = muted;
  muteLoaded = true;
  try {
    await AsyncStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (muted) {
    try {
      Speech.stop();
    } catch {
      /* ignore */
    }
  }
}

export function isNavSpeechMutedSync(): boolean {
  return mutedMemory;
}

export function stopNavSpeech(): void {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
}

export function speakNav(text: string, opts?: { force?: boolean; language?: string }): void {
  const phrase = text.trim();
  if (!phrase) return;
  if (!opts?.force && mutedMemory) return;
  try {
    Speech.stop();
    Speech.speak(phrase, {
      language: opts?.language ?? 'fr-FR',
      rate: 0.95,
      pitch: 1.0,
    });
  } catch {
    /* soft-fail — TTS unavailable on some web builds */
  }
}

export function formatDistanceFr(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const m = Math.max(10, Math.round((km * 1000) / 10) * 10);
    return `${m} mètres`;
  }
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${rounded} kilomètres`;
}

export function speakUpcomingTurn(instruction: string, distanceKm: number): void {
  const dist = formatDistanceFr(distanceKm);
  const clean = instruction.replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!clean) return;
  speakNav(dist ? `Dans ${dist}: ${clean}` : clean);
}

export function speakArrival(durationMin?: number, distanceKm?: number): void {
  const bits = ['Arrivée à destination'];
  if (typeof durationMin === 'number' && durationMin > 0) {
    bits.push(`temps estimé ${Math.round(durationMin)} minutes`);
  }
  if (typeof distanceKm === 'number' && distanceKm > 0) {
    bits.push(formatDistanceFr(distanceKm));
  }
  speakNav(bits.join(', '));
}

export function speakWeighAlert(distanceKm: number, name?: string): void {
  const dist = formatDistanceFr(distanceKm);
  const label = name ? `balance ${name}` : 'balance';
  speakNav(dist ? `Attention, ${label} à ${dist}` : `Attention, ${label} proche`);
}
