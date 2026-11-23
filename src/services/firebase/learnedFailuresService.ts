/**
 * Module 14 — owner-scoped learned failures (no public VIN dump).
 * Never persist raw VIN; make/model optional; reads filtered by authorUid.
 */
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import { COLLECTIONS } from '../../types/firestore';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

export type LearnedFailure = {
  id: string;
  summary: string;
  likelyParts: string[];
  make?: string;
  model?: string;
  createdAt: string;
};

export async function listLearnedFailures(max = 20): Promise<ServiceResult<LearnedFailure[]>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) {
    return mockResult(
      [
        {
          id: 'mock-lf-1',
          summary: 'Bruit roulement — remplacé moyeu AV',
          likelyParts: ['Roulement moyeu'],
          createdAt: new Date().toISOString(),
        },
      ],
      'MOCK bases — Firebase off / non connecté',
    );
  }
  try {
    const q = query(
      collection(fb.db, COLLECTIONS.learnedFailures),
      where('authorUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(Math.min(Math.max(max, 1), 50)),
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
    return liveResult(items);
  } catch (e) {
    return failResult([], e instanceof Error ? e.message : 'Lecture bases refusée');
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
  if (!fb || !uid) return mockResult(payload, 'MOCK learn — non syncé');
  if (!payload.summary) return failResult(null, 'Résumé requis');

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
    return failResult(null, e instanceof Error ? e.message : 'Écriture bases refusée');
  }
}
