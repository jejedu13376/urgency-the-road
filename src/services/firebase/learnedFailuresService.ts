/**
 * Module 14 — owner-scoped learned failures (no public VIN dump).
 * Never persist raw VIN; make/model optional; reads filtered by authorUid.
 * Unsigned path: AsyncStorage journal. On Auth: merge + upload; clear only after list OK.
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

type MigrateResult = {
  /** Remote docs just written (for in-memory merge if list fails). */
  uploadedRemote: LearnedFailure[];
  /** Local journal ids successfully written this run. */
  uploadedLocalIds: string[];
  /** Local ids already present remotely (migratedFromLocalId). */
  alreadyRemote: string[];
  /** Local rows that failed to upload. */
  failed: LearnedFailure[];
};

/** Single-flight so overlapping list + record don't double addDoc. */
let migrateInFlight: Promise<MigrateResult> | null = null;

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
  if (!rows.length) {
    await AsyncStorage.removeItem(LOCAL_KEY);
    return;
  }
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 100)));
}

function fingerprint(row: LearnedFailure): string {
  return `${row.summary}|${row.createdAt}|${(row.likelyParts ?? []).join(',')}`;
}

/** Local ids already uploaded (field migratedFromLocalId). */
async function fetchAlreadyMigratedIds(db: Firestore, localIds: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (!localIds.length) return found;
  for (let i = 0; i < localIds.length; i += 30) {
    const chunk = localIds.slice(i, i + 30);
    try {
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.learnedFailures),
          where('migratedFromLocalId', 'in', chunk),
        ),
      );
      for (const d of snap.docs) {
        const mid = d.data().migratedFromLocalId;
        if (typeof mid === 'string') found.add(mid);
      }
    } catch {
      // Rules/index may block — skip detection; single-flight still prevents parallel doubles
    }
  }
  return found;
}

/**
 * Upload unsigned AsyncStorage rows to Firestore.
 * Does NOT clear AsyncStorage — caller clears only after a successful list query.
 */
async function migrateLocalJournal(db: Firestore, uid: string): Promise<MigrateResult> {
  if (migrateInFlight) return migrateInFlight;

  migrateInFlight = (async (): Promise<MigrateResult> => {
    const local = await readLocalJournal();
    if (!local.length) {
      return { uploadedRemote: [], uploadedLocalIds: [], alreadyRemote: [], failed: [] };
    }

    const already = await fetchAlreadyMigratedIds(
      db,
      local.map((r) => r.id),
    );
    const alreadyRemote = [...already];
    const uploadedRemote: LearnedFailure[] = [];
    const uploadedLocalIds: string[] = [];
    const failed: LearnedFailure[] = [];

    for (const row of local) {
      if (!row.summary.trim()) continue;
      if (already.has(row.id)) continue;
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
        already.add(row.id);
        uploadedLocalIds.push(row.id);
        uploadedRemote.push({ ...row, id: ref.id });
      } catch {
        failed.push(row);
      }
    }

    return { uploadedRemote, uploadedLocalIds, alreadyRemote, failed };
  })().finally(() => {
    migrateInFlight = null;
  });

  return migrateInFlight;
}

function mergeByFingerprint(remote: LearnedFailure[], local: LearnedFailure[]): LearnedFailure[] {
  const seen = new Set(remote.map(fingerprint));
  const extras = local.filter((r) => r.id !== DEMO_SEED.id && !seen.has(fingerprint(r)));
  return [...remote, ...extras].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/**
 * After list succeeds: drop only known-migrated ids from the *current* journal.
 * Re-read AsyncStorage so concurrent recordLearnedFailure appends after localBefore
 * are not wiped by rebuilding from a stale snapshot.
 */
async function pruneLocalAfterListOk(mig: MigrateResult): Promise<void> {
  const removable = new Set([...mig.alreadyRemote, ...mig.uploadedLocalIds]);
  if (!removable.size) return;
  const current = await readLocalJournal();
  const keep = current.filter((r) => !removable.has(r.id));
  await writeLocalJournal(keep);
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

  const localBefore = await readLocalJournal();
  let mig: MigrateResult = {
    uploadedRemote: [],
    uploadedLocalIds: [],
    alreadyRemote: [],
    failed: [],
  };
  try {
    mig = await migrateLocalJournal(fb.db, uid);
  } catch {
    // keep localBefore intact
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

    // List succeeded — prune only migrated ids from current journal (not stale snapshot)
    await pruneLocalAfterListOk(mig);
    const pendingLocal = await readLocalJournal();

    const merged = mergeByFingerprint(items, pendingLocal).slice(0, cap);
    const labelBits = [
      mig.uploadedLocalIds.length ? `${mig.uploadedLocalIds.length} local→Firestore` : null,
      pendingLocal.length ? `${pendingLocal.length} local restant(s)` : null,
    ].filter(Boolean);
    return liveResult(
      merged,
      labelBits.length ? `Bases Firestore LIVE · ${labelBits.join(' · ')}` : undefined,
    );
  } catch (e) {
    // Query failed — journal stays intact; merge local + in-memory uploads for UI
    const merged = mergeByFingerprint(
      mig.uploadedRemote,
      localBefore.length ? localBefore : await readLocalJournal(),
    );
    if (!merged.some((r) => r.id === DEMO_SEED.id) && !localBefore.length && !mig.uploadedRemote.length) {
      merged.push(DEMO_SEED);
    }
    return failResult(
      merged.slice(0, cap),
      e instanceof Error ? e.message : 'Lecture bases refusée — journal local intact',
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

  // Flush pending local rows (no clear — list clears after successful query)
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
