/**
 * Module 14 — persist resolved failure patterns when signed in.
 */
import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import { COLLECTIONS } from '../../types/firestore';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

export type LearnedFailure = {
  id: string;
  summary: string;
  likelyParts: string[];
  make?: string;
  model?: string;
  vin?: string;
  createdAt: string;
};

export async function listLearnedFailures(max = 20): Promise<ServiceResult<LearnedFailure[]>> {
  const fb = getFirebase();
  if (!fb) {
    return mockResult(
      [
        {
          id: 'mock-lf-1',
          summary: 'Bruit roulement — remplacé moyeu AV',
          likelyParts: ['Roulement moyeu'],
          createdAt: new Date().toISOString(),
        },
      ],
      'MOCK bases — Firebase off',
    );
  }
  try {
    const q = query(
      collection(fb.db, COLLECTIONS.learnedFailures),
      orderBy('createdAt', 'desc'),
      limit(max),
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
        vin: data.vin ? String(data.vin) : undefined,
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
  vin?: string;
}): Promise<ServiceResult<LearnedFailure | null>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  const payload: LearnedFailure = {
    id: `local-${Date.now()}`,
    summary: input.summary.trim(),
    likelyParts: input.likelyParts,
    make: input.make,
    model: input.model,
    vin: input.vin,
    createdAt: new Date().toISOString(),
  };
  if (!fb || !uid) return mockResult(payload, 'MOCK learn — non syncé');
  if (!payload.summary) return failResult(null, 'Résumé requis');

  try {
    const ref = await addDoc(collection(fb.db, COLLECTIONS.learnedFailures), {
      authorUid: uid,
      summary: payload.summary,
      likelyParts: payload.likelyParts,
      make: payload.make ?? null,
      model: payload.model ?? null,
      vin: payload.vin ?? null,
      createdAt: payload.createdAt,
    });
    return liveResult({ ...payload, id: ref.id });
  } catch (e) {
    return failResult(null, e instanceof Error ? e.message : 'Écriture bases refusée');
  }
}
