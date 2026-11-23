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
import { liveResult, mockResult, ServiceResult } from './result';

/** Strip undefined (Firestore rejects them; no ignoreUndefinedProperties). */
function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

function toDoc(v: VehicleProfile, ownerUid: string): Omit<VehicleDoc, 'id'> & { id?: string; techNotes?: string[]; fluidsSource?: string } {
  const fluids = omitUndefined({
    engineOilL: v.fluids.engineOilL,
    coolantL: v.fluids.coolantL,
    washerL: v.fluids.washerL,
    fuelL: v.fluids.fuelL,
  });
  return omitUndefined({
    id: v.id,
    ownerUid,
    vin: v.vin,
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
  };
}

/** Module 1–2 */
export async function listVehicles(ownerUid: string): Promise<ServiceResult<VehicleProfile[]>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) return mockResult(MOCK_FLEET, 'MOCK vehicles — flotte locale (non connecté)');

  const q = query(collection(fb.db, COLLECTIONS.vehicles), where('ownerUid', '==', uid));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => fromDoc({ id: d.id, ...(d.data() as Omit<VehicleDoc, 'id'>) }));
  return liveResult(list);
}

export async function upsertVehicle(
  ownerUid: string,
  vehicle: VehicleProfile,
): Promise<ServiceResult<VehicleProfile>> {
  const fb = getFirebase();
  const uid = getSignedInUid();
  if (!fb || !uid) return mockResult(vehicle, 'MOCK vehicles — upsert local (non connecté)');

  const payload = toDoc(vehicle, uid);
  if (vehicle.id && !vehicle.id.startsWith('decoded-') && !vehicle.id.startsWith('cascade-')) {
    await setDoc(doc(fb.db, COLLECTIONS.vehicles, vehicle.id), payload, { merge: true });
    return liveResult(vehicle);
  }
  const ref = await addDoc(collection(fb.db, COLLECTIONS.vehicles), payload);
  return liveResult({ ...vehicle, id: ref.id });
}

export async function removeVehicle(id: string): Promise<ServiceResult<null>> {
  const fb = getFirebase();
  if (!fb || !getSignedInUid()) return mockResult(null, 'MOCK vehicles — delete local');
  await deleteDoc(doc(fb.db, COLLECTIONS.vehicles, id));
  return liveResult(null);
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
