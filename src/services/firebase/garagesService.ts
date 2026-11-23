import { addDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { MOCK_PLACES } from '../../data/mocks';
import { getFirebase } from '../../firebase/config';
import type { GarageDoc, GarageRatingDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import { liveResult, mockResult, ServiceResult } from './result';

function fromMockPlaces(): GarageDoc[] {
  return MOCK_PLACES.filter((p) => p.kind !== 'pesage').map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind as GarageDoc['kind'],
    address: p.address,
    phone: p.phone,
    hours: p.hours,
    lat: p.lat,
    lon: p.lon,
    ratingAvg: 4.2,
    ratingCount: 3,
    updatedAt: new Date().toISOString(),
  }));
}

/** Module 9 */
export async function listGaragesNearby(): Promise<ServiceResult<GarageDoc[]>> {
  const fb = getFirebase();
  if (!fb) return mockResult(fromMockPlaces(), 'MOCK garages — pins locaux');

  const snap = await getDocs(query(collection(fb.db, COLLECTIONS.garages), limit(50)));
  if (snap.empty) {
    return mockResult(fromMockPlaces(), 'MOCK garages — Firestore vide, fallback local');
  }
  return liveResult(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GarageDoc, 'id'>) })));
}

export async function submitGarageRating(
  rating: Omit<GarageRatingDoc, 'id' | 'createdAt'>,
): Promise<ServiceResult<GarageRatingDoc>> {
  const payload: GarageRatingDoc = {
    ...rating,
    id: `rating-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const fb = getFirebase();
  if (!fb) return mockResult(payload, 'MOCK garage rating');
  const ref = await addDoc(collection(fb.db, COLLECTIONS.garageRatings), payload);
  return liveResult({ ...payload, id: ref.id });
}
