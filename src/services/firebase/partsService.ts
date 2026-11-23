import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getFirebase } from '../../firebase/config';
import type { PartDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { buildVinPartsCatalog, catalogLabel } from '../parts/vinPartsCatalog';
import { normalizeVin } from '../vin/vinNormalize';
import { liveResult, mockResult, ServiceResult } from './result';

/** Module 3 — catalogue pièces lié au VIN (Firestore ou générateur local WMI). */
export async function listPartsForVin(
  vin?: string,
  opts?: { isHeavyTruck?: boolean },
): Promise<ServiceResult<PartDoc[]>> {
  const fb = getFirebase();
  const local = buildVinPartsCatalog(vin, { isHeavyTruck: opts?.isHeavyTruck });

  if (!fb) {
    return mockResult(local, catalogLabel(vin, 'local'));
  }

  const clean = vin ? normalizeVin(vin) : '';
  const col = collection(fb.db, COLLECTIONS.parts);
  const q =
    clean.length >= 8
      ? query(col, where('vinPrefix', '==', clean.slice(0, 8)), limit(50))
      : query(col, limit(50));
  const snap = await getDocs(q);
  if (snap.empty) {
    return mockResult(local, `${catalogLabel(vin, 'local')} · Firestore vide`);
  }
  return liveResult(
    snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PartDoc, 'id'>) })),
    catalogLabel(vin, 'firebase'),
  );
}
