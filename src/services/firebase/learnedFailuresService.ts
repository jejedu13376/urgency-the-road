/**
 * Module 14 — owner-scoped learned failures (no public VIN dump).
 * Never persist raw VIN; make/model optional; reads filtered by authorUid.
 * Unsigned path: AsyncStorage journal. On Auth: merge + upload local then clear.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import { COLLECTIONS } from '../../types/firestore';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

const LOCAL_KEY = 'urgency.learnedFailures.v1';

export type LearnedFailure = {
  id: string;
  summary: string;
  likelyParts: string[];
  make?: string;
  model?: string;
  createdAt: string;
};

const DEMO_SEED: LearnedFailure = {
  id: 'mock-lf-1',
  summary: 'Bruit roulement — remplacé moyeu AV',
  likelyParts: ['Roulement moyeu'],
  createdAt: '2024-01-01T00:00:00.000Z',
};

async function readLocalJournal(): Promise<LearnedFailure[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is LearnedFailure => row && typeof row === 'object' && typeof row.id === 'string')
      .map((row) => ({
        id: row.id,
        summary: String(row.summary ?? ''),
        likelyParts: Array.isArray(row.likelyParts) ? row.likelyParts.map(String) : [],
        make: row.make ? String(row.make) : undefined,
        model: row.model ? String(row.model) : undefined,
        createdAt: String(row.createdAt ?? ''),
      }));
  } catch {
    return [];
  }
}

async function writeLocalJournal(rows: LearnedFailure[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 100)));
}

async function clearLocalJournal(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_KEY);
}

function fingerprint(row: LearnedFailure): string {
  return `${row.summary}|${row.createdAt}|${(row.likelyParts ?? []).join(',')}`;
}

/** Upload unsigned AsyncStorage rows to Firestore; clear local on full success. */
async function migrateLocalJournal(
  db: Firestore,
  uid: string,
): Promise<{ uploaded: LearnedFailure[]; remaining: LearnedFailure[] }> {
  const local = await readLocalJournal();
  if (!local.length) return { uploaded: [], remaining: [] };

  const uploaded: LearnedFailure[] = [];
  const remaining: LearnedFailure[] = [];

  for (const row of local) {
    if (!row.summary.trim()) continue;
    try {
      const doc: Record<string, unknown> = {
        authorUid: uid,
        summary: row.summary,
        likelyParts: row.likelyParts,
        createdAt: row.createdAt || new Date().toISOString(),
        migratedFromLocalId: row.id,
      };
      if (row.make) doc.make = row.make;
      if (row.model) doc.model = row.model;
      const ref = await addDoc(collection(db, COLLECTIONS.learnedFailures), doc);
      uploaded.push({ ...row, id: ref.id });
    } catch {
      remaining.push(row);
    }
  }

  if (remaining.length === 0) {
    await clearLocalJournal();
  } else {
    await writeLocalJournal(remaining);
  }
  return { uploaded, remaining };
}

function mergeByFingerprint(remote: LearnedFailure[], local: LearnedFailure[]): LearnedFailure[] {
  const seen = new Set(remote.map(fingerprint));
  const extras = local.filter((r) => r.id !== DEMO_SEED.id && !seen.has(fingerprint(r)));
  return [...remote, ...extras].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function listLearnedFailures(max = 20): Promise<ServiceResult<LearnedFailure[]>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  const cap = Math.min(Math.max(max, 1), 50);

  if (!fb || !uid) {
    const local = await readLocalJournal();
    const merged = [...local];
    if (!merged.some((r) => r.id === DEMO_SEED.id)) {
      merged.push(DEMO_SEED);
    }
    merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return mockResult(
      merged.slice(0, cap),
      local.length
        ? `Journal local AsyncStorage (${local.length}) — Auth pour sync Firestore`
        : 'MOCK bases — journal local vide · Firebase off / non connecté',
    );
  }

  // Sign-in path: upload local journal first (best-effort), then list + merge leftovers
  let migrated = 0;
  let pendingLocal: LearnedFailure[] = [];
  try {
    const mig = await migrateLocalJournal(fb.db, uid);
    migrated = mig.uploaded.length;
    pendingLocal = mig.remaining;
  } catch {
    pendingLocal = await readLocalJournal();
  }

  try {
    const q = query(
      collection(fb.db, COLLECTIONS.learnedFailures),
      where('authorUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(cap),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        summary: String(data.summary ?? ''),
        likelyParts: Array.isArray(data.likelyParts) ? (data.likelyParts as string[]) : [],
        make: data.make ? String(data.make) : undefined,
        model: data.model ? String(data.model) : undefined,
        createdAt: String(data.createdAt ?? ''),
      };
    });
    const merged = mergeByFingerprint(items, pendingLocal).slice(0, cap);
    const labelBits = [
      migrated ? `${migrated} local→Firestore` : null,
      pendingLocal.length ? `${pendingLocal.length} local restant(s)` : null,
    ].filter(Boolean);
    return liveResult(
      merged,
      labelBits.length ? `Bases Firestore LIVE · ${labelBits.join(' · ')}` : undefined,
    );
  } catch (e) {
    // Rules/network fail — still show local journal so unsigned entries aren't hidden
    const local = pendingLocal.length ? pendingLocal : await readLocalJournal();
    const merged = [...local];
    if (!merged.some((r) => r.id === DEMO_SEED.id)) merged.push(DEMO_SEED);
    merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return failResult(
      merged.slice(0, cap),
      e instanceof Error ? e.message : 'Lecture bases refusée — journal local affiché',
    );
  }
}

export async function recordLearnedFailure(input: {
  summary: string;
  likelyParts: string[];
  make?: string;
  model?: string;
  /** Ignored — VIN never written to Firestore */
  vin?: string;
}): Promise<ServiceResult<LearnedFailure | null>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  const payload: LearnedFailure = {
    id: `local-${Date.now()}`,
    summary: input.summary.trim().slice(0, 1800),
    likelyParts: (input.likelyParts ?? []).slice(0, 12),
    make: input.make?.trim() || undefined,
    model: input.model?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  if (!payload.summary) return failResult(null, 'Résumé requis');

  if (!fb || !uid) {
    const local = await readLocalJournal();
    const next = [payload, ...local.filter((r) => r.id !== payload.id)];
    await writeLocalJournal(next);
    return mockResult(payload, 'Journal local AsyncStorage — connectez-vous pour sync Firestore');
  }

  // Flush any pending local rows before writing the new one
  try {
    await migrateLocalJournal(fb.db, uid);
  } catch {
    // non-fatal
  }

  try {
    const doc: Record<string, unknown> = {
      authorUid: uid,
      summary: payload.summary,
      likelyParts: payload.likelyParts,
      createdAt: payload.createdAt,
    };
    if (payload.make) doc.make = payload.make;
    if (payload.model) doc.model = payload.model;
    // Intentionally omit vin — rules also reject vin keys
    const ref = await addDoc(collection(fb.db, COLLECTIONS.learnedFailures), doc);
    return liveResult({ ...payload, id: ref.id });
  } catch (e) {
    // Keep on device so the entry isn't lost when rules reject the write
    const local = await readLocalJournal();
    await writeLocalJournal([payload, ...local.filter((r) => r.id !== payload.id)]);
    return failResult(
      payload,
      e instanceof Error
        ? `${e.message} — gardé en journal local`
        : 'Écriture bases refusée — gardé en journal local',
    );
  }
}
