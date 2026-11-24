/**
 * Post-trip voice logbook — metadata in AsyncStorage; audio files via expo-audio document dir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteAudioFile } from './deleteAudioFile';
import { formatDurationMs } from './formatDuration';

export { formatDurationMs };

const KEY = 'um.voiceLogbook.v1';

export type VoiceLogNote = {
  id: string;
  uri: string;
  createdAt: string;
  durationMs: number;
  title: string;
  tripLabel?: string;
  tripLat?: number;
  tripLon?: number;
  vehicleMode?: 'voiture' | 'camion';
  /** Caption when shared to Fil (audio file itself stays on-device). */
  sharedToFeedAt?: string;
};

export type VoiceLogbookStore = {
  notes: VoiceLogNote[];
  updatedAt: string;
};

async function readRaw(): Promise<VoiceLogbookStore> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { notes: [], updatedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw) as VoiceLogbookStore;
    if (!parsed || !Array.isArray(parsed.notes)) {
      return { notes: [], updatedAt: new Date().toISOString() };
    }
    return {
      notes: parsed.notes.filter((n) => n && typeof n.id === 'string' && typeof n.uri === 'string'),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return { notes: [], updatedAt: new Date().toISOString() };
  }
}

async function writeRaw(store: VoiceLogbookStore): Promise<void> {
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ ...store, updatedAt: new Date().toISOString() }),
  );
}

export async function listVoiceNotes(): Promise<VoiceLogNote[]> {
  const store = await readRaw();
  return [...store.notes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function addVoiceNote(
  input: Omit<VoiceLogNote, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): Promise<VoiceLogNote> {
  const note: VoiceLogNote = {
    id: input.id ?? `vn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    uri: input.uri,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    title: input.title.trim() || 'Note vocale trajet',
    tripLabel: input.tripLabel?.trim() || undefined,
    tripLat: input.tripLat,
    tripLon: input.tripLon,
    vehicleMode: input.vehicleMode,
    sharedToFeedAt: input.sharedToFeedAt,
  };
  const store = await readRaw();
  store.notes = [note, ...store.notes.filter((n) => n.id !== note.id)];
  await writeRaw(store);
  return note;
}

export async function updateVoiceNote(
  id: string,
  patch: Partial<Omit<VoiceLogNote, 'id'>>,
): Promise<VoiceLogNote | null> {
  const store = await readRaw();
  const idx = store.notes.findIndex((n) => n.id === id);
  if (idx < 0) return null;
  const next = { ...store.notes[idx], ...patch, id };
  store.notes[idx] = next;
  await writeRaw(store);
  return next;
}

export async function removeVoiceNote(id: string): Promise<boolean> {
  const store = await readRaw();
  const target = store.notes.find((n) => n.id === id);
  if (!target) return false;
  store.notes = store.notes.filter((n) => n.id !== id);
  await writeRaw(store);
  await deleteAudioFile(target.uri);
  return true;
}
