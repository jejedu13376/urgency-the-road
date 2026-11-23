import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { MOCK_FLEET, mockDecodeVin } from '../../data/mocks';
import { getFirebase, getSignedInUid } from '../../firebase/config';
import type { VehicleDoc } from '../../types/firestore';
import { COLLECTIONS } from '../../types/firestore';
import type { VehicleProfile } from '../../types/vehicle';
import { decodeVinNhtsa } from '../vin/nhtsaDecode';
import { failResult, liveResult, mockResult, ServiceResult } from './result';

/** Local-only temp ids — must not be used as Firestore doc ids (would create orphans on retry). */
function isLocalTempId(id: string): boolean {
  return (
    id.startsWith('cascade-') ||
    id.startsWith('decoded-') ||
    id.startsWith('nhtsa-')
  );
}

function normalizeVin(vin: string | undefined): string {
  return (vin ?? '').trim().toUpperCase();
}

/** Strip undefined (Firestore rejects them; no ignoreUndefinedProperties). */
function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

type VehiclePayload = Omit<VehicleDoc, 'id'> & {
  id?: string;
  techNotes?: string[];
  fluidsSource?: string;
  clientLocalId?: string;
};

/**
 * Build Firestore payload. Never persist a local temp id as `id` — that would make
 * listVehicles (spread data over doc id) revert remaps to cascade-* after a pull.
 * Temp ids go in `clientLocalId` for retry dedupe.
 */
function toDoc(
  v: VehicleProfile,
  ownerUid: string,
  firestoreId?: string,
): VehiclePayload {
  const vin = normalizeVin(v.vin);
  const fluids = omitUndefined({
    engineOilL: v.fluids.engineOilL,
    coolantL: v.fluids.coolantL,
    washerL: v.fluids.washerL,
    fuelL: v.fluids.fuelL,
  });
  const temp = isLocalTempId(v.id);
  const id = firestoreId ?? (temp ? undefined : v.id);
  return omitUndefined({
    id,
    ownerUid,
    vin: vin || v.vin,
    label: v.label,
    continent: v.continent,
    country: v.country,
    make: v.make,
    model: v.model,
    year: v.year,
    powertrain: v.powertrain,
    vehicleClass: v.vehicleClass,
    fluids,
    commonFailures: v.commonFailures,
    odometerKm: v.odometerKm,
    unitSystem: v.unitSystem,
    currency: v.currency,
    techNotes: v.techNotes,
    fluidsSource: v.fluidsSource,
    clientLocalId: temp ? v.id : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function fromDoc(d: VehicleDoc & { techNotes?: string[]; fluidsSource?: string }): VehicleProfile {
  return {
    id: d.id,
    label: d.label,
    vin: d.vin,
    continent: d.continent as VehicleProfile['continent'],
    country: d.country,
    make: d.make,
    model: d.model,
    year: d.year,
    powertrain: d.powertrain as VehicleProfile['powertrain'],
    vehicleClass: d.vehicleClass as VehicleProfile['vehicleClass'],
    fluids: d.fluids,
    commonFailures: d.commonFailures as VehicleProfile['commonFailures'],
    odometerKm: d.odometerKm,
    unitSystem: d.unitSystem,
    currency: d.currency as VehicleProfile['currency'],
    techNotes: d.techNotes,
    fluidsSource: d.fluidsSource === 'oem_api' ? 'oem_api' : d.fluidsSource === 'local_estimate' ? 'local_estimate' : undefined,
    // Preserve migrate rematch key — refreshCloud drops local temps that already live on cloud.
    clientLocalId: d.clientLocalId,
  };
}

/** Module 1–2 */
export async function listVehicles(ownerUid: string): Promise<ServiceResult<VehicleProfile[]>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) return mockResult(MOCK_FLEET, 'MOCK vehicles — flotte locale (non connecté)');

  try {
    const q = query(collection(fb.db, COLLECTIONS.vehicles), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    // Prefer Firestore document id — never let a stale body `id` (cascade-*) win.
    const list = snap.docs.map((d) =>
      fromDoc({ ...(d.data() as Omit<VehicleDoc, 'id'>), id: d.id }),
    );
    return liveResult(list);
  } catch (e) {
    // Empty payload + ok:false — never ship MOCK_FLEET as a firebase-looking failure.
    return failResult([], e instanceof Error ? e.message : 'Lecture flotte refusée');
  }
}

type OwnedSnap = Awaited<ReturnType<typeof getDocs>>;

/**
 * Find existing cloud row for a local-temp vehicle.
 * Rematch ONLY via exact VIN or clientLocalId/stale body id — never fingerprint.
 * Two identical no-VIN cascade trucks must get separate Firestore docs (addDoc).
 */
function findExistingForTemp(
  owned: OwnedSnap,
  vehicle: VehicleProfile,
): { id: string } | null {
  const vin = normalizeVin(vehicle.vin);
  if (vin.length >= 8) {
    const byVin = owned.docs.find(
      (d) => normalizeVin((d.data() as { vin?: string }).vin) === vin,
    );
    if (byVin) return { id: byVin.id };
  }

  // Rematch prior migrate: clientLocalId, or orphan body still carrying cascade-* id.
  const byLocal = owned.docs.find((d) => {
    const data = d.data() as { clientLocalId?: string; id?: string };
    return data.clientLocalId === vehicle.id || data.id === vehicle.id;
  });
  if (byLocal) return { id: byLocal.id };

  return null;
}

export async function upsertVehicle(
  ownerUid: string,
  vehicle: VehicleProfile,
): Promise<ServiceResult<VehicleProfile>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) return mockResult(vehicle, 'MOCK vehicles — upsert local (non connecté)');

  try {
    // Stable Firestore id already → merge update (never addDoc again).
    if (vehicle.id && !isLocalTempId(vehicle.id)) {
      const payload = toDoc(vehicle, uid, vehicle.id);
      await setDoc(doc(fb.db, COLLECTIONS.vehicles, vehicle.id), payload, { merge: true });
      return liveResult(vehicle);
    }

    // Local temp id: reuse existing cloud row (VIN / clientLocalId only) — no orphan addDoc.
    const owned = await getDocs(
      query(collection(fb.db, COLLECTIONS.vehicles), where('ownerUid', '==', uid)),
    );
    const hit = findExistingForTemp(owned, vehicle);
    if (hit) {
      const payload = toDoc(vehicle, uid, hit.id);
      await setDoc(doc(fb.db, COLLECTIONS.vehicles, hit.id), payload, { merge: true });
      return liveResult({ ...vehicle, id: hit.id });
    }

    // First migrate: addDoc, then write body id = doc id (never the cascade-* temp).
    const draft = toDoc(vehicle, uid);
    const ref = await addDoc(collection(fb.db, COLLECTIONS.vehicles), draft);
    const payload = toDoc(vehicle, uid, ref.id);
    await setDoc(ref, payload, { merge: true });
    return liveResult({ ...vehicle, id: ref.id });
  } catch (e) {
    return failResult(vehicle, e instanceof Error ? e.message : 'Upsert véhicule refusé');
  }
}

export async function removeVehicle(id: string): Promise<ServiceResult<null>> {
  const fb = getFirebase();
  if (!fb || !getSignedInUid()) return mockResult(null, 'MOCK vehicles — delete local');
  try {
    await deleteDoc(doc(fb.db, COLLECTIONS.vehicles, id));
    return liveResult(null);
  } catch (e) {
    return failResult(null, e instanceof Error ? e.message : 'Suppression véhicule refusée');
  }
}

/** VIN decode: NHTSA vPIC (free, no key) first; WMI mock fallback if network fails. */
export async function decodeVinRemote(vin: string): Promise<ServiceResult<VehicleProfile | null>> {
  const nhtsa = await decodeVinNhtsa(vin);
  if (nhtsa.ok && nhtsa.profile) {
    return liveResult(nhtsa.profile, 'NHTSA vPIC live — décodage constructeur public');
  }
  const decoded = mockDecodeVin(vin);
  if (!decoded) {
    return mockResult(null, nhtsa.message ?? 'VIN invalide / non décodé');
  }
  return mockResult(
    decoded,
    `Fallback WMI local — NHTSA: ${nhtsa.message ?? 'indisponible'} (pas d’API OEM privée)`,
  );
}
