/**
 * NHTSA vPIC DecodeVin — free public API, no client secret.
 * https://vpic.nhtsa.dot.gov/api/
 */
import type { ContinentCode, Powertrain, VehicleClass, VehicleProfile } from '../../types/vehicle';
import { buildLocalCommonFailures } from '../vehicle/localFailures';
import { estimateLocalFluids } from '../vehicle/localFluids';
import { normalizeVin, vinCheckDigitOk } from './vinNormalize';

type NhtsaResult = { Variable: string; Value: string | null };

function pick(results: NhtsaResult[], name: string): string {
  const hit = results.find((r) => r.Variable === name);
  return (hit?.Value ?? '').trim();
}

function parseDisplacementL(raw: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function guessContinent(wmi: string, plantCountry: string): ContinentCode {
  const c = plantCountry.toUpperCase();
  if (c.includes('UNITED STATES') || c.includes('CANADA') || c.includes('MEXICO')) return 'NA';
  if (c.includes('AUSTRALIA')) return 'AU';
  if (c.includes('JAPAN') || c.includes('KOREA') || c.includes('CHINA')) return 'AS';
  if (c.includes('GERMANY') || c.includes('FRANCE') || c.includes('ITALY') || c.includes('SPAIN')) return 'EU';
  const ch = wmi.charAt(0).toUpperCase();
  if ('12345'.includes(ch)) return 'NA';
  if (ch === '6') return 'AU';
  if ('JKL'.includes(ch)) return 'AS';
  return 'EU';
}

function guessCountry(continent: ContinentCode, plantCountry: string): string {
  const up = plantCountry.toUpperCase();
  const map: Record<string, string> = {
    FRANCE: 'FR', GERMANY: 'DE', 'UNITED STATES': 'US', CANADA: 'CA', JAPAN: 'JP', AUSTRALIA: 'AU',
  };
  for (const [k, v] of Object.entries(map)) {
    if (up.includes(k)) return v;
  }
  if (continent === 'NA') return 'US';
  if (continent === 'AU') return 'AU';
  if (continent === 'AS') return 'JP';
  return 'FR';
}

function guessPowertrain(fuel: string, body: string, gvwr: string): Powertrain {
  const f = fuel.toLowerCase();
  const b = body.toLowerCase();
  const g = gvwr.toLowerCase();
  if (g.includes('class 7') || g.includes('class 8') || (f.includes('diesel') && b.includes('incomplete'))) {
    return 'poids_lourd_diesel';
  }
  if (f.includes('electric')) return 'electrique';
  if (f.includes('hybrid')) return 'hybride';
  if (f.includes('diesel')) return 'diesel';
  return 'essence';
}

function guessClass(body: string, powertrain: Powertrain, gvwr: string): VehicleClass {
  if (powertrain === 'poids_lourd_diesel') return 'poids_lourd';
  const b = body.toLowerCase();
  if (gvwr.toLowerCase().includes('class 3') || b.includes('pickup') || b.includes('truck')) return 'pickup';
  if (b.includes('sport utility') || b.includes('mpv')) return 'suv';
  return 'voiture';
}

export type NhtsaDecodeOutcome = {
  ok: boolean;
  profile: VehicleProfile | null;
  source: 'nhtsa' | 'error';
  message?: string;
};

export async function decodeVinNhtsa(vinRaw: string): Promise<NhtsaDecodeOutcome> {
  const vin = normalizeVin(vinRaw);
  if (vin.length < 11) {
    return { ok: false, profile: null, source: 'error', message: 'VIN trop court (min. 11).' };
  }
  const check = vinCheckDigitOk(vin);
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, profile: null, source: 'error', message: `NHTSA HTTP ${res.status}` };
    const body = (await res.json()) as { Results?: NhtsaResult[] };
    const results = body.Results ?? [];
    const make = pick(results, 'Make') || pick(results, 'Manufacturer Name');
    const model = pick(results, 'Model');
    const yearStr = pick(results, 'Model Year');
    const errorText = pick(results, 'Error Text');
    if (!make && !model) {
      return {
        ok: false,
        profile: null,
        source: 'error',
        message:
          errorText ||
          (check === false ? 'VIN non reconnu NHTSA (chiffre de contrôle invalide)' : 'VIN non reconnu NHTSA'),
      };
    }
    const fuel = pick(results, 'Fuel Type - Primary');
    const bodyClass = pick(results, 'Body Class');
    const gvwr = pick(results, 'Gross Vehicle Weight Rating From');
    const plantCountry = pick(results, 'Plant Country');
    const displacementRaw = pick(results, 'Displacement (L)');
    const cylinders = pick(results, 'Engine Number of Cylinders');
    const driveType = pick(results, 'Drive Type');
    const displacementL = parseDisplacementL(displacementRaw);
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const continent = guessContinent(vin.slice(0, 3), plantCountry);
    const country = guessCountry(continent, plantCountry);
    const powertrain = guessPowertrain(fuel, bodyClass, gvwr);
    const vehicleClass = guessClass(bodyClass, powertrain, gvwr);
    const fluidsEst = estimateLocalFluids({
      vehicleClass,
      powertrain,
      displacementL,
      make: make || undefined,
    });
    const nhtsaHints = [
      bodyClass ? `Carrosserie: ${bodyClass}` : '',
      plantCountry ? `Usine: ${plantCountry}` : '',
      fuel ? `Carburant: ${fuel}` : '',
      displacementL != null ? `Cylindrée: ${displacementL} L` : '',
      cylinders ? `Cylindres: ${cylinders}` : '',
      driveType ? `Transmission: ${driveType}` : '',
      check === false ? 'Attention : chiffre de contrôle VIN (pos. 9) invalide' : '',
    ].filter(Boolean);
    const profile: VehicleProfile = {
      id: `nhtsa-${vin}`,
      label: `${make} ${model} ${year}`.trim(),
      vin,
      continent,
      country,
      make: make || 'Inconnu',
      model: model || 'Inconnu',
      year,
      powertrain,
      vehicleClass,
      fluids: fluidsEst.fluids,
      fluidsSource: 'local_estimate',
      techNotes: [
        ...nhtsaHints,
        fluidsEst.label,
        'API fluides OEM constructeur : option externe (MVP = estimation locale)',
      ],
      commonFailures: buildLocalCommonFailures({
        make: make || 'Inconnu',
        powertrain,
        vehicleClass,
        nhtsaHints,
      }),
      odometerKm: 0,
      unitSystem: continent === 'NA' ? 'imperial' : 'metric', // AU = metric
      currency: continent === 'NA' ? (country === 'CA' ? 'CAD' : 'USD') : continent === 'AU' ? 'AUD' : 'EUR',
    };
    return { ok: true, profile, source: 'nhtsa' };
  } catch (e) {
    return {
      ok: false,
      profile: null,
      source: 'error',
      message: e instanceof Error ? e.message : 'Erreur réseau NHTSA',
    };
  }
}
