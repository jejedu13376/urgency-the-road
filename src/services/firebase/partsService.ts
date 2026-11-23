import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { MOCK_PARTS } from '../../data/mocks';
import { getFirebase } from '../../firebase/config';
import { hintFromWmi, normalizeVin } from '../vin/vinNormalize';
import type { PartDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

function toPartDocs(vin?: string): PartDoc[] {
  const clean = vin ? normalizeVin(vin) : '';
  const hint = clean.length >= 3 ? hintFromWmi(clean) : null;
  const makeKey = hint?.make?.split(/[\s/]/)[0]?.toLowerCase() ?? '';

  let rows: PartDoc[] = MOCK_PARTS.map((p) => ({
    ...p,
    currency: p.currency,
    updatedAt: new Date().toISOString(),
    buyUrlStub: `https://www.google.com/search?q=${encodeURIComponent(
      `${p.oemSku} ${p.name} pièce auto`,
    )}`,
    vinPrefix: clean.length >= 8 ? clean.slice(0, 8) : undefined,
    vehicleMake: hint?.make,
  }));

  if (makeKey && makeKey !== 'générique' && makeKey !== 'oem') {
    const filtered = rows.filter(
      (p) =>
        p.name.toLowerCase().includes(makeKey.slice(0, 4)) ||
        p.oemSku.toLowerCase().includes(makeKey.slice(0, 3)) ||
        p.category === 'filtre' ||
        p.category === 'fluide',
    );
    if (filtered.length) rows = filtered;
  }

  return rows;
}

/** Module 3 — catalogue pièces lié au VIN (Firestore ou mock filtré WMI). */
export async function listPartsForVin(vin?: string): Promise<ServiceResult<PartDoc[]>> {
  const fb = getFirebase();
  const local = toPartDocs(vin);

  if (!fb) {
    return mockResult(
      local,
      vin
        ? `Catalogue local filtré VIN ${normalizeVin(vin).slice(0, 8)}… (WMI)`
        : 'MOCK parts — catalogue local',
    );
  }

  const clean = vin ? normalizeVin(vin) : '';
  const col = collection(fb.db, COLLECTIONS.parts);
  const q =
    clean.length >= 8
      ? query(col, where('vinPrefix', '==', clean.slice(0, 8)), limit(50))
      : query(col, limit(50));
  const snap = await getDocs(q);
  if (snap.empty) {
    return mockResult(local, 'Firestore parts vide — fallback catalogue local filtré VIN');
  }
  return liveResult(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PartDoc, 'id'>) })));
}
