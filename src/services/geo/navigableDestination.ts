/**
 * Remap coarse admin destinations (province / state / country) to a navigable
 * city so TomTom / Valhalla / OSRM can snap to the road network.
 *
 * Wilderness centroids (e.g. Photon BC ≈ 55°N, −125°W) produce crude or failed
 * itineraries. Capitals / primary cities for AU · CA · US · EU only.
 */

export type NavigableDestination = {
  lat: number;
  lon: number;
  label: string;
  /** True when we replaced an admin centroid with a city. */
  remapped: boolean;
  /** Matched admin key when remapped. */
  adminKey?: string;
};

type City = { lat: number; lon: number; city: string };

/** Canonical admin name → navigable city (road-network friendly). */
const ADMIN_CITIES: Record<string, City> = {
  // —— Canada (provinces / territories) ——
  'british columbia': { lat: 49.2827, lon: -123.1207, city: 'Vancouver' },
  'colombie-britannique': { lat: 49.2827, lon: -123.1207, city: 'Vancouver' },
  alberta: { lat: 51.0447, lon: -114.0719, city: 'Calgary' },
  saskatchewan: { lat: 50.4452, lon: -104.6189, city: 'Regina' },
  manitoba: { lat: 49.8951, lon: -97.1384, city: 'Winnipeg' },
  ontario: { lat: 43.6532, lon: -79.3832, city: 'Toronto' },
  quebec: { lat: 46.8139, lon: -71.208, city: 'Québec' },
  québec: { lat: 46.8139, lon: -71.208, city: 'Québec' },
  'new brunswick': { lat: 45.9636, lon: -66.6431, city: 'Fredericton' },
  'nouveau-brunswick': { lat: 45.9636, lon: -66.6431, city: 'Fredericton' },
  'nova scotia': { lat: 44.6488, lon: -63.5752, city: 'Halifax' },
  'nouvelle-ecosse': { lat: 44.6488, lon: -63.5752, city: 'Halifax' },
  'nouvelle-écosse': { lat: 44.6488, lon: -63.5752, city: 'Halifax' },
  'prince edward island': { lat: 46.2382, lon: -63.1311, city: 'Charlottetown' },
  'ile-du-prince-edouard': { lat: 46.2382, lon: -63.1311, city: 'Charlottetown' },
  'île-du-prince-édouard': { lat: 46.2382, lon: -63.1311, city: 'Charlottetown' },
  newfoundland: { lat: 47.5615, lon: -52.7126, city: "St. John's" },
  'newfoundland and labrador': { lat: 47.5615, lon: -52.7126, city: "St. John's" },
  'terre-neuve': { lat: 47.5615, lon: -52.7126, city: "St. John's" },
  'terre-neuve-et-labrador': { lat: 47.5615, lon: -52.7126, city: "St. John's" },
  yukon: { lat: 60.7212, lon: -135.0568, city: 'Whitehorse' },
  'northwest territories': { lat: 62.454, lon: -114.3718, city: 'Yellowknife' },
  'territoires du nord-ouest': { lat: 62.454, lon: -114.3718, city: 'Yellowknife' },
  nunavut: { lat: 63.7467, lon: -68.517, city: 'Iqaluit' },

  // —— United States (states + DC) — primary city, not always capital ——
  alabama: { lat: 33.5207, lon: -86.8025, city: 'Birmingham' },
  alaska: { lat: 61.2176, lon: -149.8997, city: 'Anchorage' },
  arizona: { lat: 33.4484, lon: -112.074, city: 'Phoenix' },
  arkansas: { lat: 34.7465, lon: -92.2896, city: 'Little Rock' },
  california: { lat: 34.0522, lon: -118.2437, city: 'Los Angeles' },
  californie: { lat: 34.0522, lon: -118.2437, city: 'Los Angeles' },
  colorado: { lat: 39.7392, lon: -104.9903, city: 'Denver' },
  connecticut: { lat: 41.7658, lon: -72.6734, city: 'Hartford' },
  delaware: { lat: 39.7391, lon: -75.5398, city: 'Wilmington' },
  florida: { lat: 25.7617, lon: -80.1918, city: 'Miami' },
  floride: { lat: 25.7617, lon: -80.1918, city: 'Miami' },
  georgia: { lat: 33.749, lon: -84.388, city: 'Atlanta' },
  géorgie: { lat: 33.749, lon: -84.388, city: 'Atlanta' },
  hawaii: { lat: 21.3069, lon: -157.8583, city: 'Honolulu' },
  hawaï: { lat: 21.3069, lon: -157.8583, city: 'Honolulu' },
  idaho: { lat: 43.615, lon: -116.2023, city: 'Boise' },
  illinois: { lat: 41.8781, lon: -87.6298, city: 'Chicago' },
  indiana: { lat: 39.7684, lon: -86.1581, city: 'Indianapolis' },
  iowa: { lat: 41.5868, lon: -93.625, city: 'Des Moines' },
  kansas: { lat: 39.0997, lon: -94.5786, city: 'Kansas City' },
  kentucky: { lat: 38.2527, lon: -85.7585, city: 'Louisville' },
  louisiana: { lat: 29.9511, lon: -90.0715, city: 'New Orleans' },
  louisiane: { lat: 29.9511, lon: -90.0715, city: 'New Orleans' },
  maine: { lat: 43.6591, lon: -70.2568, city: 'Portland' },
  maryland: { lat: 39.2904, lon: -76.6122, city: 'Baltimore' },
  massachusetts: { lat: 42.3601, lon: -71.0589, city: 'Boston' },
  michigan: { lat: 42.3314, lon: -83.0458, city: 'Detroit' },
  minnesota: { lat: 44.9778, lon: -93.265, city: 'Minneapolis' },
  mississippi: { lat: 32.2988, lon: -90.1848, city: 'Jackson' },
  missouri: { lat: 38.627, lon: -90.1994, city: 'St. Louis' },
  montana: { lat: 45.7833, lon: -108.5007, city: 'Billings' },
  nebraska: { lat: 41.2565, lon: -95.9345, city: 'Omaha' },
  nevada: { lat: 36.1699, lon: -115.1398, city: 'Las Vegas' },
  'new hampshire': { lat: 42.9956, lon: -71.4548, city: 'Manchester' },
  'new jersey': { lat: 40.7357, lon: -74.1724, city: 'Newark' },
  'new mexico': { lat: 35.0844, lon: -106.6504, city: 'Albuquerque' },
  'nouveau-mexique': { lat: 35.0844, lon: -106.6504, city: 'Albuquerque' },
  'new york': { lat: 40.7128, lon: -74.006, city: 'New York' },
  'north carolina': { lat: 35.2271, lon: -80.8431, city: 'Charlotte' },
  'caroline du nord': { lat: 35.2271, lon: -80.8431, city: 'Charlotte' },
  'north dakota': { lat: 46.8772, lon: -96.7898, city: 'Fargo' },
  ohio: { lat: 39.9612, lon: -82.9988, city: 'Columbus' },
  oklahoma: { lat: 35.4676, lon: -97.5164, city: 'Oklahoma City' },
  oregon: { lat: 45.5152, lon: -122.6784, city: 'Portland' },
  pennsylvania: { lat: 39.9526, lon: -75.1652, city: 'Philadelphia' },
  pennsylvanie: { lat: 39.9526, lon: -75.1652, city: 'Philadelphia' },
  'rhode island': { lat: 41.824, lon: -71.4128, city: 'Providence' },
  'south carolina': { lat: 32.7765, lon: -79.9311, city: 'Charleston' },
  'caroline du sud': { lat: 32.7765, lon: -79.9311, city: 'Charleston' },
  'south dakota': { lat: 43.5473, lon: -96.7283, city: 'Sioux Falls' },
  tennessee: { lat: 36.1627, lon: -86.7816, city: 'Nashville' },
  texas: { lat: 29.7604, lon: -95.3698, city: 'Houston' },
  utah: { lat: 40.7608, lon: -111.891, city: 'Salt Lake City' },
  vermont: { lat: 44.4759, lon: -73.2121, city: 'Burlington' },
  virginia: { lat: 36.8529, lon: -75.978, city: 'Virginia Beach' },
  virginie: { lat: 36.8529, lon: -75.978, city: 'Virginia Beach' },
  washington: { lat: 47.6062, lon: -122.3321, city: 'Seattle' },
  'west virginia': { lat: 38.3498, lon: -81.6326, city: 'Charleston' },
  wisconsin: { lat: 43.0389, lon: -87.9065, city: 'Milwaukee' },
  wyoming: { lat: 41.14, lon: -104.8202, city: 'Cheyenne' },
  'district of columbia': { lat: 38.9072, lon: -77.0369, city: 'Washington' },
  'washington dc': { lat: 38.9072, lon: -77.0369, city: 'Washington' },
  'washington, dc': { lat: 38.9072, lon: -77.0369, city: 'Washington' },

  // —— Australia (states / territories) ——
  'new south wales': { lat: -33.8688, lon: 151.2093, city: 'Sydney' },
  'nouvelle-galles du sud': { lat: -33.8688, lon: 151.2093, city: 'Sydney' },
  victoria: { lat: -37.8136, lon: 144.9631, city: 'Melbourne' },
  queensland: { lat: -27.4698, lon: 153.0251, city: 'Brisbane' },
  'western australia': { lat: -31.9505, lon: 115.8605, city: 'Perth' },
  'australie-occidentale': { lat: -31.9505, lon: 115.8605, city: 'Perth' },
  'south australia': { lat: -34.9285, lon: 138.6007, city: 'Adelaide' },
  'australie-meridionale': { lat: -34.9285, lon: 138.6007, city: 'Adelaide' },
  'australie-méridionale': { lat: -34.9285, lon: 138.6007, city: 'Adelaide' },
  tasmania: { lat: -42.8821, lon: 147.3272, city: 'Hobart' },
  tasmanie: { lat: -42.8821, lon: 147.3272, city: 'Hobart' },
  'northern territory': { lat: -12.4634, lon: 130.8456, city: 'Darwin' },
  'territoire du nord': { lat: -12.4634, lon: 130.8456, city: 'Darwin' },
  'australian capital territory': { lat: -35.2809, lon: 149.13, city: 'Canberra' },
  'territoire de la capitale australienne': { lat: -35.2809, lon: 149.13, city: 'Canberra' },
  australia: { lat: -33.8688, lon: 151.2093, city: 'Sydney' },
  australie: { lat: -33.8688, lon: 151.2093, city: 'Sydney' },

  // —— Europe (countries — when user picks the country, not a city) ——
  france: { lat: 48.8566, lon: 2.3522, city: 'Paris' },
  germany: { lat: 52.52, lon: 13.405, city: 'Berlin' },
  allemagne: { lat: 52.52, lon: 13.405, city: 'Berlin' },
  spain: { lat: 40.4168, lon: -3.7038, city: 'Madrid' },
  espagne: { lat: 40.4168, lon: -3.7038, city: 'Madrid' },
  italy: { lat: 41.9028, lon: 12.4964, city: 'Rome' },
  italie: { lat: 41.9028, lon: 12.4964, city: 'Rome' },
  'united kingdom': { lat: 51.5074, lon: -0.1278, city: 'London' },
  'royaume-uni': { lat: 51.5074, lon: -0.1278, city: 'London' },
  england: { lat: 51.5074, lon: -0.1278, city: 'London' },
  angleterre: { lat: 51.5074, lon: -0.1278, city: 'London' },
  portugal: { lat: 38.7223, lon: -9.1393, city: 'Lisbon' },
  netherlands: { lat: 52.3676, lon: 4.9041, city: 'Amsterdam' },
  'pays-bas': { lat: 52.3676, lon: 4.9041, city: 'Amsterdam' },
  belgium: { lat: 50.8503, lon: 4.3517, city: 'Brussels' },
  belgique: { lat: 50.8503, lon: 4.3517, city: 'Brussels' },
  switzerland: { lat: 46.948, lon: 7.4474, city: 'Bern' },
  suisse: { lat: 46.948, lon: 7.4474, city: 'Bern' },
  austria: { lat: 48.2082, lon: 16.3738, city: 'Vienna' },
  autriche: { lat: 48.2082, lon: 16.3738, city: 'Vienna' },
  poland: { lat: 52.2297, lon: 21.0122, city: 'Warsaw' },
  pologne: { lat: 52.2297, lon: 21.0122, city: 'Warsaw' },
  ireland: { lat: 53.3498, lon: -6.2603, city: 'Dublin' },
  irlande: { lat: 53.3498, lon: -6.2603, city: 'Dublin' },
  sweden: { lat: 59.3293, lon: 18.0686, city: 'Stockholm' },
  suède: { lat: 59.3293, lon: 18.0686, city: 'Stockholm' },
  norway: { lat: 59.9139, lon: 10.7522, city: 'Oslo' },
  norvège: { lat: 59.9139, lon: 10.7522, city: 'Oslo' },
  denmark: { lat: 55.6761, lon: 12.5683, city: 'Copenhagen' },
  danemark: { lat: 55.6761, lon: 12.5683, city: 'Copenhagen' },
  finland: { lat: 60.1699, lon: 24.9384, city: 'Helsinki' },
  finlande: { lat: 60.1699, lon: 24.9384, city: 'Helsinki' },
  greece: { lat: 37.9838, lon: 23.7275, city: 'Athens' },
  grèce: { lat: 37.9838, lon: 23.7275, city: 'Athens' },
  'czech republic': { lat: 50.0755, lon: 14.4378, city: 'Prague' },
  tchéquie: { lat: 50.0755, lon: 14.4378, city: 'Prague' },
  'republique tcheque': { lat: 50.0755, lon: 14.4378, city: 'Prague' },
  'république tchèque': { lat: 50.0755, lon: 14.4378, city: 'Prague' },
  romania: { lat: 44.4268, lon: 26.1025, city: 'Bucharest' },
  roumanie: { lat: 44.4268, lon: 26.1025, city: 'Bucharest' },
  hungary: { lat: 47.4979, lon: 19.0402, city: 'Budapest' },
  hongrie: { lat: 47.4979, lon: 19.0402, city: 'Budapest' },
  canada: { lat: 45.5017, lon: -73.5673, city: 'Montréal' },
  'united states': { lat: 40.7128, lon: -74.006, city: 'New York' },
  'etats-unis': { lat: 40.7128, lon: -74.006, city: 'New York' },
  'états-unis': { lat: 40.7128, lon: -74.006, city: 'New York' },
  usa: { lat: 40.7128, lon: -74.006, city: 'New York' },
};

function normalizeAdminToken(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9àâäéèêëïîôùûüç\s\-']/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip diacritics for key lookup (keys stored both with/without accents). */
function lookupKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAdmin(label: string): { key: string; city: City } | null {
  // Only the primary place name (before first comma) — never remap
  // "Orlando, Florida" / "Miami, FL" just because the state appears later.
  const primary = normalizeAdminToken(label.split(/[,|/·•]/)[0] ?? label);
  if (!primary) return null;

  const tryKey = (raw: string): { key: string; city: City } | null => {
    const key = lookupKey(raw);
    const hit = ADMIN_CITIES[key] ?? ADMIN_CITIES[raw];
    if (hit) return { key, city: hit };
    for (const prefix of [
      'state of ',
      'province of ',
      'province de ',
      'etat de ',
      'état de ',
      'commonwealth of ',
    ]) {
      const nk = lookupKey(raw);
      if (nk.startsWith(prefix)) {
        const rest = nk.slice(prefix.length).trim();
        const nested = ADMIN_CITIES[rest];
        if (nested) return { key: rest, city: nested };
      }
    }
    return null;
  };

  const direct = tryKey(primary);
  if (direct) return direct;

  // Whole label is exactly an admin (+ optional country already stripped as primary).
  return tryKey(normalizeAdminToken(label));
}

/**
 * If `label` names a known AU/CA/US/EU admin region, return its navigable city.
 * City / street labels that don't match pass through unchanged.
 */
export function resolveNavigableDestination(
  lat: number,
  lon: number,
  label: string,
): NavigableDestination {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { lat, lon, label, remapped: false };
  }
  const matched = matchAdmin(label);
  if (!matched) {
    return { lat, lon, label: label.trim() || `${lat.toFixed(5)}, ${lon.toFixed(5)}`, remapped: false };
  }
  const { key, city } = matched;
  // Already near the city (user picked Vancouver, not BC) — keep coords, polish label only if admin-only.
  const dLat = Math.abs(lat - city.lat);
  const dLon = Math.abs(lon - city.lon);
  if (dLat < 0.35 && dLon < 0.35) {
    return { lat, lon, label: label.trim() || city.city, remapped: false, adminKey: key };
  }
  const nice = `${city.city} (${label.split(',')[0]?.trim() || key})`;
  return {
    lat: city.lat,
    lon: city.lon,
    label: nice,
    remapped: true,
    adminKey: key,
  };
}
