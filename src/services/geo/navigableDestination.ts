/**
 * Remap coarse admin destinations (province / state / country) to a navigable
 * city so TomTom / Valhalla / OSRM can snap to the road network.
 *
 * Wilderness centroids (e.g. Photon BC ≈ 55°N, −125°W) produce crude or failed
 * itineraries. Capitals / primary cities for AU · CA · US · Europe.
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

export type RegionScope = 'CA' | 'US' | 'AU' | 'EU';

type City = { lat: number; lon: number; city: string };

type AdminEntry = {
  /** Stable id for coverage audits (not a lookup key). */
  id: string;
  scope: RegionScope;
  city: City;
  /** Lookup aliases (EN / FR / abbreviations). Stored lowercased via lookupKey. */
  aliases: string[];
};

/**
 * Canonical coverage — every US state + DC, every AU state/territory,
 * every Canadian province/territory, and Europe (EU + EFTA + UK + Balkans +
 * microstates + UA/MD/BY + UK nations). Routing itself is worldwide via
 * TomTom/OSRM; this table only remaps admin centroids.
 */
export const ADMIN_REGION_ENTRIES: readonly AdminEntry[] = [
  // —— Canada (13) ——
  {
    id: 'CA-BC',
    scope: 'CA',
    city: { lat: 49.2827, lon: -123.1207, city: 'Vancouver' },
    aliases: ['british columbia', 'colombie-britannique', 'bc', 'c-b'],
  },
  {
    id: 'CA-AB',
    scope: 'CA',
    city: { lat: 51.0447, lon: -114.0719, city: 'Calgary' },
    aliases: ['alberta', 'ab'],
  },
  {
    id: 'CA-SK',
    scope: 'CA',
    city: { lat: 50.4452, lon: -104.6189, city: 'Regina' },
    aliases: ['saskatchewan', 'sk'],
  },
  {
    id: 'CA-MB',
    scope: 'CA',
    city: { lat: 49.8951, lon: -97.1384, city: 'Winnipeg' },
    aliases: ['manitoba', 'mb'],
  },
  {
    id: 'CA-ON',
    scope: 'CA',
    city: { lat: 43.6532, lon: -79.3832, city: 'Toronto' },
    aliases: ['ontario', 'on'],
  },
  {
    id: 'CA-QC',
    scope: 'CA',
    city: { lat: 46.8139, lon: -71.208, city: 'Québec' },
    aliases: ['quebec', 'québec', 'qc'],
  },
  {
    id: 'CA-NB',
    scope: 'CA',
    city: { lat: 45.9636, lon: -66.6431, city: 'Fredericton' },
    aliases: ['new brunswick', 'nouveau-brunswick', 'nb'],
  },
  {
    id: 'CA-NS',
    scope: 'CA',
    city: { lat: 44.6488, lon: -63.5752, city: 'Halifax' },
    aliases: ['nova scotia', 'nouvelle-ecosse', 'nouvelle-écosse', 'ns'],
  },
  {
    id: 'CA-PE',
    scope: 'CA',
    city: { lat: 46.2382, lon: -63.1311, city: 'Charlottetown' },
    aliases: [
      'prince edward island',
      'ile-du-prince-edouard',
      'île-du-prince-édouard',
      'pei',
    ],
  },
  {
    id: 'CA-NL',
    scope: 'CA',
    city: { lat: 47.5615, lon: -52.7126, city: "St. John's" },
    aliases: [
      'newfoundland',
      'newfoundland and labrador',
      'terre-neuve',
      'terre-neuve-et-labrador',
      'nl',
    ],
  },
  {
    id: 'CA-YT',
    scope: 'CA',
    city: { lat: 60.7212, lon: -135.0568, city: 'Whitehorse' },
    aliases: ['yukon', 'yt', 'yukon territory', 'territoire du yukon'],
  },
  {
    id: 'CA-NT',
    scope: 'CA',
    city: { lat: 62.454, lon: -114.3718, city: 'Yellowknife' },
    // No bare "nt" — collides with AU Northern Territory; use nwt / full name.
    aliases: ['northwest territories', 'territoires du nord-ouest', 'nwt'],
  },
  {
    id: 'CA-NU',
    scope: 'CA',
    city: { lat: 63.7467, lon: -68.517, city: 'Iqaluit' },
    aliases: ['nunavut', 'nu'],
  },
  {
    id: 'CA',
    scope: 'CA',
    city: { lat: 45.5017, lon: -73.5673, city: 'Montréal' },
    aliases: ['canada'],
  },

  // —— United States (50 + DC) ——
  {
    id: 'US-AL',
    scope: 'US',
    city: { lat: 33.5207, lon: -86.8025, city: 'Birmingham' },
    aliases: ['alabama', 'al'],
  },
  {
    id: 'US-AK',
    scope: 'US',
    city: { lat: 61.2176, lon: -149.8997, city: 'Anchorage' },
    aliases: ['alaska', 'ak'],
  },
  {
    id: 'US-AZ',
    scope: 'US',
    city: { lat: 33.4484, lon: -112.074, city: 'Phoenix' },
    aliases: ['arizona', 'az'],
  },
  {
    id: 'US-AR',
    scope: 'US',
    city: { lat: 34.7465, lon: -92.2896, city: 'Little Rock' },
    aliases: ['arkansas', 'ar'],
  },
  {
    id: 'US-CA',
    scope: 'US',
    city: { lat: 34.0522, lon: -118.2437, city: 'Los Angeles' },
    // No bare "ca" — too easy to confuse with Canada; full name / Californie only.
    aliases: ['california', 'californie'],
  },
  {
    id: 'US-CO',
    scope: 'US',
    city: { lat: 39.7392, lon: -104.9903, city: 'Denver' },
    aliases: ['colorado', 'co'],
  },
  {
    id: 'US-CT',
    scope: 'US',
    city: { lat: 41.7658, lon: -72.6734, city: 'Hartford' },
    aliases: ['connecticut', 'ct'],
  },
  {
    id: 'US-DE',
    scope: 'US',
    city: { lat: 39.7391, lon: -75.5398, city: 'Wilmington' },
    aliases: ['delaware', 'de'],
  },
  {
    id: 'US-FL',
    scope: 'US',
    city: { lat: 25.7617, lon: -80.1918, city: 'Miami' },
    aliases: ['florida', 'floride', 'fl'],
  },
  {
    id: 'US-GA',
    scope: 'US',
    city: { lat: 33.749, lon: -84.388, city: 'Atlanta' },
    aliases: ['georgia', 'ga'],
  },
  {
    id: 'US-HI',
    scope: 'US',
    city: { lat: 21.3069, lon: -157.8583, city: 'Honolulu' },
    aliases: ['hawaii', 'hawaï', 'hi'],
  },
  {
    id: 'US-ID',
    scope: 'US',
    city: { lat: 43.615, lon: -116.2023, city: 'Boise' },
    aliases: ['idaho', 'id'],
  },
  {
    id: 'US-IL',
    scope: 'US',
    city: { lat: 41.8781, lon: -87.6298, city: 'Chicago' },
    aliases: ['illinois', 'il'],
  },
  {
    id: 'US-IN',
    scope: 'US',
    city: { lat: 39.7684, lon: -86.1581, city: 'Indianapolis' },
    aliases: ['indiana', 'in'],
  },
  {
    id: 'US-IA',
    scope: 'US',
    city: { lat: 41.5868, lon: -93.625, city: 'Des Moines' },
    aliases: ['iowa', 'ia'],
  },
  {
    id: 'US-KS',
    scope: 'US',
    city: { lat: 39.0997, lon: -94.5786, city: 'Kansas City' },
    aliases: ['kansas', 'ks'],
  },
  {
    id: 'US-KY',
    scope: 'US',
    city: { lat: 38.2527, lon: -85.7585, city: 'Louisville' },
    aliases: ['kentucky', 'ky'],
  },
  {
    id: 'US-LA',
    scope: 'US',
    city: { lat: 29.9511, lon: -90.0715, city: 'New Orleans' },
    aliases: ['louisiana', 'louisiane', 'la'],
  },
  {
    id: 'US-ME',
    scope: 'US',
    city: { lat: 43.6591, lon: -70.2568, city: 'Portland' },
    aliases: ['maine', 'me'],
  },
  {
    id: 'US-MD',
    scope: 'US',
    city: { lat: 39.2904, lon: -76.6122, city: 'Baltimore' },
    aliases: ['maryland', 'md'],
  },
  {
    id: 'US-MA',
    scope: 'US',
    city: { lat: 42.3601, lon: -71.0589, city: 'Boston' },
    aliases: ['massachusetts', 'ma'],
  },
  {
    id: 'US-MI',
    scope: 'US',
    city: { lat: 42.3314, lon: -83.0458, city: 'Detroit' },
    aliases: ['michigan', 'mi'],
  },
  {
    id: 'US-MN',
    scope: 'US',
    city: { lat: 44.9778, lon: -93.265, city: 'Minneapolis' },
    aliases: ['minnesota', 'mn'],
  },
  {
    id: 'US-MS',
    scope: 'US',
    city: { lat: 32.2988, lon: -90.1848, city: 'Jackson' },
    aliases: ['mississippi', 'ms'],
  },
  {
    id: 'US-MO',
    scope: 'US',
    city: { lat: 38.627, lon: -90.1994, city: 'St. Louis' },
    aliases: ['missouri', 'mo'],
  },
  {
    id: 'US-MT',
    scope: 'US',
    city: { lat: 45.7833, lon: -108.5007, city: 'Billings' },
    aliases: ['montana', 'mt'],
  },
  {
    id: 'US-NE',
    scope: 'US',
    city: { lat: 41.2565, lon: -95.9345, city: 'Omaha' },
    aliases: ['nebraska', 'ne'],
  },
  {
    id: 'US-NV',
    scope: 'US',
    city: { lat: 36.1699, lon: -115.1398, city: 'Las Vegas' },
    aliases: ['nevada', 'nv'],
  },
  {
    id: 'US-NH',
    scope: 'US',
    city: { lat: 42.9956, lon: -71.4548, city: 'Manchester' },
    aliases: ['new hampshire', 'nh'],
  },
  {
    id: 'US-NJ',
    scope: 'US',
    city: { lat: 40.7357, lon: -74.1724, city: 'Newark' },
    aliases: ['new jersey', 'nj'],
  },
  {
    id: 'US-NM',
    scope: 'US',
    city: { lat: 35.0844, lon: -106.6504, city: 'Albuquerque' },
    aliases: ['new mexico', 'nouveau-mexique', 'nm'],
  },
  {
    id: 'US-NY',
    scope: 'US',
    city: { lat: 40.7128, lon: -74.006, city: 'New York' },
    aliases: ['new york', 'ny'],
  },
  {
    id: 'US-NC',
    scope: 'US',
    city: { lat: 35.2271, lon: -80.8431, city: 'Charlotte' },
    aliases: ['north carolina', 'caroline du nord', 'nc'],
  },
  {
    id: 'US-ND',
    scope: 'US',
    city: { lat: 46.8772, lon: -96.7898, city: 'Fargo' },
    aliases: ['north dakota', 'dakota du nord', 'nd'],
  },
  {
    id: 'US-OH',
    scope: 'US',
    city: { lat: 39.9612, lon: -82.9988, city: 'Columbus' },
    aliases: ['ohio', 'oh'],
  },
  {
    id: 'US-OK',
    scope: 'US',
    city: { lat: 35.4676, lon: -97.5164, city: 'Oklahoma City' },
    aliases: ['oklahoma', 'ok'],
  },
  {
    id: 'US-OR',
    scope: 'US',
    city: { lat: 45.5152, lon: -122.6784, city: 'Portland' },
    aliases: ['oregon', 'or'],
  },
  {
    id: 'US-PA',
    scope: 'US',
    city: { lat: 39.9526, lon: -75.1652, city: 'Philadelphia' },
    aliases: ['pennsylvania', 'pennsylvanie', 'pa'],
  },
  {
    id: 'US-RI',
    scope: 'US',
    city: { lat: 41.824, lon: -71.4128, city: 'Providence' },
    aliases: ['rhode island', 'ri'],
  },
  {
    id: 'US-SC',
    scope: 'US',
    city: { lat: 32.7765, lon: -79.9311, city: 'Charleston' },
    aliases: ['south carolina', 'caroline du sud', 'sc'],
  },
  {
    id: 'US-SD',
    scope: 'US',
    city: { lat: 43.5473, lon: -96.7283, city: 'Sioux Falls' },
    aliases: ['south dakota', 'dakota du sud', 'sd'],
  },
  {
    id: 'US-TN',
    scope: 'US',
    city: { lat: 36.1627, lon: -86.7816, city: 'Nashville' },
    aliases: ['tennessee', 'tn'],
  },
  {
    id: 'US-TX',
    scope: 'US',
    city: { lat: 29.7604, lon: -95.3698, city: 'Houston' },
    aliases: ['texas', 'tx'],
  },
  {
    id: 'US-UT',
    scope: 'US',
    city: { lat: 40.7608, lon: -111.891, city: 'Salt Lake City' },
    aliases: ['utah', 'ut'],
  },
  {
    id: 'US-VT',
    scope: 'US',
    city: { lat: 44.4759, lon: -73.2121, city: 'Burlington' },
    aliases: ['vermont', 'vt'],
  },
  {
    id: 'US-VA',
    scope: 'US',
    city: { lat: 36.8529, lon: -75.978, city: 'Virginia Beach' },
    aliases: ['virginia', 'virginie', 'va'],
  },
  {
    id: 'US-WA',
    scope: 'US',
    city: { lat: 47.6062, lon: -122.3321, city: 'Seattle' },
    // No bare "wa" — collides with AU Western Australia.
    aliases: ['washington', 'washington state', 'etat de washington', 'état de washington'],
  },
  {
    id: 'US-WV',
    scope: 'US',
    city: { lat: 38.3498, lon: -81.6326, city: 'Charleston' },
    aliases: ['west virginia', 'virginie-occidentale', 'wv'],
  },
  {
    id: 'US-WI',
    scope: 'US',
    city: { lat: 43.0389, lon: -87.9065, city: 'Milwaukee' },
    aliases: ['wisconsin', 'wi'],
  },
  {
    id: 'US-WY',
    scope: 'US',
    city: { lat: 41.14, lon: -104.8202, city: 'Cheyenne' },
    aliases: ['wyoming', 'wy'],
  },
  {
    id: 'US-DC',
    scope: 'US',
    city: { lat: 38.9072, lon: -77.0369, city: 'Washington' },
    aliases: [
      'district of columbia',
      'washington dc',
      'washington, dc',
      'washington d.c.',
      'dc',
      'd.c.',
    ],
  },
  {
    id: 'US',
    scope: 'US',
    city: { lat: 40.7128, lon: -74.006, city: 'New York' },
    aliases: ['united states', 'united states of america', 'etats-unis', 'états-unis', 'usa', 'u.s.a.', 'u.s.'],
  },

  // —— Australia (8 states/territories + country) ——
  {
    id: 'AU-NSW',
    scope: 'AU',
    city: { lat: -33.8688, lon: 151.2093, city: 'Sydney' },
    aliases: ['new south wales', 'nouvelle-galles du sud', 'nsw'],
  },
  {
    id: 'AU-VIC',
    scope: 'AU',
    city: { lat: -37.8136, lon: 144.9631, city: 'Melbourne' },
    aliases: ['victoria', 'vic'],
  },
  {
    id: 'AU-QLD',
    scope: 'AU',
    city: { lat: -27.4698, lon: 153.0251, city: 'Brisbane' },
    aliases: ['queensland', 'qld'],
  },
  {
    id: 'AU-WA',
    scope: 'AU',
    city: { lat: -31.9505, lon: 115.8605, city: 'Perth' },
    aliases: ['western australia', 'australie-occidentale'],
  },
  {
    id: 'AU-SA',
    scope: 'AU',
    city: { lat: -34.9285, lon: 138.6007, city: 'Adelaide' },
    aliases: ['south australia', 'australie-meridionale', 'australie-méridionale'],
  },
  {
    id: 'AU-TAS',
    scope: 'AU',
    city: { lat: -42.8821, lon: 147.3272, city: 'Hobart' },
    aliases: ['tasmania', 'tasmanie', 'tas'],
  },
  {
    id: 'AU-NT',
    scope: 'AU',
    city: { lat: -12.4634, lon: 130.8456, city: 'Darwin' },
    aliases: ['northern territory', 'territoire du nord'],
  },
  {
    id: 'AU-ACT',
    scope: 'AU',
    city: { lat: -35.2809, lon: 149.13, city: 'Canberra' },
    aliases: [
      'australian capital territory',
      'territoire de la capitale australienne',
      'act',
      'canberra territory',
    ],
  },
  {
    id: 'AU',
    scope: 'AU',
    city: { lat: -33.8688, lon: 151.2093, city: 'Sydney' },
    aliases: ['australia', 'australie'],
  },

  // —— Europe (countries + UK nations) ——
  {
    id: 'EU-AL',
    scope: 'EU',
    city: { lat: 41.3275, lon: 19.8187, city: 'Tirana' },
    aliases: ['albania', 'albanie'],
  },
  {
    id: 'EU-AD',
    scope: 'EU',
    city: { lat: 42.5063, lon: 1.5218, city: 'Andorra la Vella' },
    aliases: ['andorra', 'andorre'],
  },
  {
    id: 'EU-AT',
    scope: 'EU',
    city: { lat: 48.2082, lon: 16.3738, city: 'Vienna' },
    aliases: ['austria', 'autriche'],
  },
  {
    id: 'EU-BY',
    scope: 'EU',
    city: { lat: 53.9006, lon: 27.559, city: 'Minsk' },
    aliases: ['belarus', 'biélorussie', 'bielorussie'],
  },
  {
    id: 'EU-BE',
    scope: 'EU',
    city: { lat: 50.8503, lon: 4.3517, city: 'Brussels' },
    aliases: ['belgium', 'belgique'],
  },
  {
    id: 'EU-BA',
    scope: 'EU',
    city: { lat: 43.8563, lon: 18.4131, city: 'Sarajevo' },
    aliases: ['bosnia', 'bosnia and herzegovina', 'bosnie', 'bosnie-herzegovine', 'bosnie-herzégovine'],
  },
  {
    id: 'EU-BG',
    scope: 'EU',
    city: { lat: 42.6977, lon: 23.3219, city: 'Sofia' },
    aliases: ['bulgaria', 'bulgarie'],
  },
  {
    id: 'EU-HR',
    scope: 'EU',
    city: { lat: 45.815, lon: 15.9819, city: 'Zagreb' },
    aliases: ['croatia', 'croatie'],
  },
  {
    id: 'EU-CY',
    scope: 'EU',
    city: { lat: 35.1856, lon: 33.3823, city: 'Nicosia' },
    aliases: ['cyprus', 'chypre'],
  },
  {
    id: 'EU-CZ',
    scope: 'EU',
    city: { lat: 50.0755, lon: 14.4378, city: 'Prague' },
    aliases: [
      'czech republic',
      'czechia',
      'tchéquie',
      'tchequie',
      'republique tcheque',
      'république tchèque',
    ],
  },
  {
    id: 'EU-DK',
    scope: 'EU',
    city: { lat: 55.6761, lon: 12.5683, city: 'Copenhagen' },
    aliases: ['denmark', 'danemark'],
  },
  {
    id: 'EU-EE',
    scope: 'EU',
    city: { lat: 59.437, lon: 24.7536, city: 'Tallinn' },
    aliases: ['estonia', 'estonie'],
  },
  {
    id: 'EU-FI',
    scope: 'EU',
    city: { lat: 60.1699, lon: 24.9384, city: 'Helsinki' },
    aliases: ['finland', 'finlande'],
  },
  {
    id: 'EU-FR',
    scope: 'EU',
    city: { lat: 48.8566, lon: 2.3522, city: 'Paris' },
    aliases: ['france'],
  },
  {
    id: 'EU-DE',
    scope: 'EU',
    city: { lat: 52.52, lon: 13.405, city: 'Berlin' },
    aliases: ['germany', 'allemagne', 'deutschland'],
  },
  {
    id: 'EU-GR',
    scope: 'EU',
    city: { lat: 37.9838, lon: 23.7275, city: 'Athens' },
    aliases: ['greece', 'grèce', 'grece', 'hellas'],
  },
  {
    id: 'EU-HU',
    scope: 'EU',
    city: { lat: 47.4979, lon: 19.0402, city: 'Budapest' },
    aliases: ['hungary', 'hongrie'],
  },
  {
    id: 'EU-IS',
    scope: 'EU',
    city: { lat: 64.1466, lon: -21.9426, city: 'Reykjavík' },
    aliases: ['iceland', 'islande'],
  },
  {
    id: 'EU-IE',
    scope: 'EU',
    city: { lat: 53.3498, lon: -6.2603, city: 'Dublin' },
    aliases: ['ireland', 'irlande', 'republic of ireland', 'eire', 'éire'],
  },
  {
    id: 'EU-IT',
    scope: 'EU',
    city: { lat: 41.9028, lon: 12.4964, city: 'Rome' },
    aliases: ['italy', 'italie'],
  },
  {
    id: 'EU-XK',
    scope: 'EU',
    city: { lat: 42.6629, lon: 21.1655, city: 'Pristina' },
    aliases: ['kosovo'],
  },
  {
    id: 'EU-LV',
    scope: 'EU',
    city: { lat: 56.9496, lon: 24.1052, city: 'Riga' },
    aliases: ['latvia', 'lettonie'],
  },
  {
    id: 'EU-LI',
    scope: 'EU',
    city: { lat: 47.141, lon: 9.5209, city: 'Vaduz' },
    aliases: ['liechtenstein'],
  },
  {
    id: 'EU-LT',
    scope: 'EU',
    city: { lat: 54.6872, lon: 25.2797, city: 'Vilnius' },
    aliases: ['lithuania', 'lituanie'],
  },
  {
    id: 'EU-LU',
    scope: 'EU',
    city: { lat: 49.6116, lon: 6.1319, city: 'Luxembourg' },
    aliases: ['luxembourg', 'grand-duche de luxembourg', 'grand-duché de luxembourg'],
  },
  {
    id: 'EU-MT',
    scope: 'EU',
    city: { lat: 35.8989, lon: 14.5146, city: 'Valletta' },
    aliases: ['malta', 'malte'],
  },
  {
    id: 'EU-MD',
    scope: 'EU',
    city: { lat: 47.0105, lon: 28.8638, city: 'Chișinău' },
    aliases: ['moldova', 'moldavie', 'republic of moldova'],
  },
  {
    id: 'EU-MC',
    scope: 'EU',
    city: { lat: 43.7384, lon: 7.4246, city: 'Monaco' },
    aliases: ['monaco'],
  },
  {
    id: 'EU-ME',
    scope: 'EU',
    city: { lat: 42.4304, lon: 19.2594, city: 'Podgorica' },
    aliases: ['montenegro', 'monténégro'],
  },
  {
    id: 'EU-NL',
    scope: 'EU',
    city: { lat: 52.3676, lon: 4.9041, city: 'Amsterdam' },
    aliases: ['netherlands', 'pays-bas', 'holland', 'hollande'],
  },
  {
    id: 'EU-MK',
    scope: 'EU',
    city: { lat: 41.9981, lon: 21.4254, city: 'Skopje' },
    aliases: [
      'north macedonia',
      'macedonia',
      'macedoine',
      'macédoine',
      'macedoine du nord',
      'macédoine du nord',
      'fyrom',
    ],
  },
  {
    id: 'EU-NO',
    scope: 'EU',
    city: { lat: 59.9139, lon: 10.7522, city: 'Oslo' },
    aliases: ['norway', 'norvège', 'norvege'],
  },
  {
    id: 'EU-PL',
    scope: 'EU',
    city: { lat: 52.2297, lon: 21.0122, city: 'Warsaw' },
    aliases: ['poland', 'pologne'],
  },
  {
    id: 'EU-PT',
    scope: 'EU',
    city: { lat: 38.7223, lon: -9.1393, city: 'Lisbon' },
    aliases: ['portugal'],
  },
  {
    id: 'EU-RO',
    scope: 'EU',
    city: { lat: 44.4268, lon: 26.1025, city: 'Bucharest' },
    aliases: ['romania', 'roumanie'],
  },
  {
    id: 'EU-RU-EUR',
    scope: 'EU',
    city: { lat: 55.7558, lon: 37.6173, city: 'Moscow' },
    aliases: ['russia', 'russian federation', 'russie', 'federation de russie', 'fédération de russie'],
  },
  {
    id: 'EU-SM',
    scope: 'EU',
    city: { lat: 43.9424, lon: 12.4578, city: 'San Marino' },
    aliases: ['san marino', 'saint-marin'],
  },
  {
    id: 'EU-RS',
    scope: 'EU',
    city: { lat: 44.7866, lon: 20.4489, city: 'Belgrade' },
    aliases: ['serbia', 'serbie'],
  },
  {
    id: 'EU-SK',
    scope: 'EU',
    city: { lat: 48.1486, lon: 17.1077, city: 'Bratislava' },
    aliases: ['slovakia', 'slovaquie'],
  },
  {
    id: 'EU-SI',
    scope: 'EU',
    city: { lat: 46.0569, lon: 14.5058, city: 'Ljubljana' },
    aliases: ['slovenia', 'slovénie', 'slovenie'],
  },
  {
    id: 'EU-ES',
    scope: 'EU',
    city: { lat: 40.4168, lon: -3.7038, city: 'Madrid' },
    aliases: ['spain', 'espagne'],
  },
  {
    id: 'EU-SE',
    scope: 'EU',
    city: { lat: 59.3293, lon: 18.0686, city: 'Stockholm' },
    aliases: ['sweden', 'suède', 'suede'],
  },
  {
    id: 'EU-CH',
    scope: 'EU',
    city: { lat: 46.948, lon: 7.4474, city: 'Bern' },
    aliases: ['switzerland', 'suisse', 'schweiz'],
  },
  {
    id: 'EU-TR-EUR',
    scope: 'EU',
    city: { lat: 41.0082, lon: 28.9784, city: 'Istanbul' },
    aliases: ['turkey', 'turkiye', 'türkiye', 'turquie'],
  },
  {
    id: 'EU-UA',
    scope: 'EU',
    city: { lat: 50.4501, lon: 30.5234, city: 'Kyiv' },
    aliases: ['ukraine'],
  },
  {
    id: 'EU-GB',
    scope: 'EU',
    city: { lat: 51.5074, lon: -0.1278, city: 'London' },
    aliases: [
      'united kingdom',
      'uk',
      'u.k.',
      'great britain',
      'britain',
      'royaume-uni',
      'grande-bretagne',
    ],
  },
  {
    id: 'EU-GB-ENG',
    scope: 'EU',
    city: { lat: 51.5074, lon: -0.1278, city: 'London' },
    aliases: ['england', 'angleterre'],
  },
  {
    id: 'EU-GB-SCT',
    scope: 'EU',
    city: { lat: 55.9533, lon: -3.1883, city: 'Edinburgh' },
    aliases: ['scotland', 'ecosse', 'écosse'],
  },
  {
    id: 'EU-GB-WLS',
    scope: 'EU',
    city: { lat: 51.4816, lon: -3.1791, city: 'Cardiff' },
    aliases: ['wales', 'pays de galles'],
  },
  {
    id: 'EU-GB-NIR',
    scope: 'EU',
    city: { lat: 54.5973, lon: -5.9301, city: 'Belfast' },
    aliases: ['northern ireland', 'irlande du nord'],
  },
  {
    id: 'EU-VA',
    scope: 'EU',
    city: { lat: 41.9029, lon: 12.4534, city: 'Vatican City' },
    aliases: ['vatican', 'vatican city', 'holy see', 'saint-siege', 'saint-siège', 'cite du vatican', 'cité du vatican'],
  },
  // French "Géorgie" → country (Tbilisi). English bare "Georgia" stays US-GA above.
  {
    id: 'EU-GE',
    scope: 'EU',
    city: { lat: 41.7151, lon: 44.8271, city: 'Tbilisi' },
    aliases: ['géorgie', 'georgie', 'republic of georgia', 'sakartvelo'],
  },
];

/** Expected canonical region ids (for coverage audits / tests). */
export const EXPECTED_REGION_IDS: Record<RegionScope, readonly string[]> = {
  CA: [
    'CA',
    'CA-AB',
    'CA-BC',
    'CA-MB',
    'CA-NB',
    'CA-NL',
    'CA-NS',
    'CA-NT',
    'CA-NU',
    'CA-ON',
    'CA-PE',
    'CA-QC',
    'CA-SK',
    'CA-YT',
  ],
  US: [
    'US',
    'US-AL',
    'US-AK',
    'US-AZ',
    'US-AR',
    'US-CA',
    'US-CO',
    'US-CT',
    'US-DE',
    'US-DC',
    'US-FL',
    'US-GA',
    'US-HI',
    'US-ID',
    'US-IL',
    'US-IN',
    'US-IA',
    'US-KS',
    'US-KY',
    'US-LA',
    'US-ME',
    'US-MD',
    'US-MA',
    'US-MI',
    'US-MN',
    'US-MS',
    'US-MO',
    'US-MT',
    'US-NE',
    'US-NV',
    'US-NH',
    'US-NJ',
    'US-NM',
    'US-NY',
    'US-NC',
    'US-ND',
    'US-OH',
    'US-OK',
    'US-OR',
    'US-PA',
    'US-RI',
    'US-SC',
    'US-SD',
    'US-TN',
    'US-TX',
    'US-UT',
    'US-VT',
    'US-VA',
    'US-WA',
    'US-WV',
    'US-WI',
    'US-WY',
  ],
  AU: ['AU', 'AU-ACT', 'AU-NSW', 'AU-NT', 'AU-QLD', 'AU-SA', 'AU-TAS', 'AU-VIC', 'AU-WA'],
  EU: [
    'EU-AL',
    'EU-AD',
    'EU-AT',
    'EU-BY',
    'EU-BE',
    'EU-BA',
    'EU-BG',
    'EU-HR',
    'EU-CY',
    'EU-CZ',
    'EU-DK',
    'EU-EE',
    'EU-FI',
    'EU-FR',
    'EU-GE',
    'EU-DE',
    'EU-GR',
    'EU-HU',
    'EU-IS',
    'EU-IE',
    'EU-IT',
    'EU-XK',
    'EU-LV',
    'EU-LI',
    'EU-LT',
    'EU-LU',
    'EU-MT',
    'EU-MD',
    'EU-MC',
    'EU-ME',
    'EU-NL',
    'EU-MK',
    'EU-NO',
    'EU-PL',
    'EU-PT',
    'EU-RO',
    'EU-RU-EUR',
    'EU-SM',
    'EU-RS',
    'EU-SK',
    'EU-SI',
    'EU-ES',
    'EU-SE',
    'EU-CH',
    'EU-TR-EUR',
    'EU-UA',
    'EU-GB',
    'EU-GB-ENG',
    'EU-GB-SCT',
    'EU-GB-WLS',
    'EU-GB-NIR',
    'EU-VA',
  ],
};

/** Explicitly out of remap scope (routing still works for city/coords picks). */
export const MISSING_REGION_NOTES: readonly string[] = [
  'English bare "Georgia" → US-GA (Atlanta); country uses FR Géorgie / "Republic of Georgia".',
  'US/AU/CA 2-letter codes can collide across countries (CA, WA, SA, NT, PE…) — primary-token match only; city labels with state as secondary are never remapped.',
  'No remaps for Asia (except country Georgia), Africa, LatAm, Oceania beyond AU, or EU overseas territories (Réunion, Guadeloupe, Greenland, Faroe…).',
  'No remaps for US territories (PR, GU, VI, AS, MP) — city/coords routing still works via TomTom/OSRM.',
];

function lookupKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s\-.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAdminToken(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9àâäéèêëïîôùûüç\s\-'.]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Flatten aliases → city. Later entries win on duplicate aliases (prefer specific). */
function buildAdminCities(): Record<string, City & { id: string }> {
  const out: Record<string, City & { id: string }> = {};
  for (const entry of ADMIN_REGION_ENTRIES) {
    for (const alias of entry.aliases) {
      const key = lookupKey(alias);
      if (!key) continue;
      out[key] = { ...entry.city, id: entry.id };
    }
  }
  return out;
}

const ADMIN_CITIES = buildAdminCities();

export type CoverageReport = {
  scope: RegionScope;
  expected: number;
  coveredIds: string[];
  missingIds: string[];
};

/** Audit expected region ids vs table — used by tests + PR report. */
export function reportNavigableCoverage(): CoverageReport[] {
  const present = new Set(ADMIN_REGION_ENTRIES.map((e) => e.id));
  return (Object.keys(EXPECTED_REGION_IDS) as RegionScope[]).map((scope) => {
    const expected = EXPECTED_REGION_IDS[scope];
    const coveredIds = expected.filter((id) => present.has(id));
    const missingIds = expected.filter((id) => !present.has(id));
    return {
      scope,
      expected: expected.length,
      coveredIds,
      missingIds,
    };
  });
}

/**
 * Nation/region aliases that are also common city names elsewhere
 * (Holland MI, Malta MT, England AR, Wales AK, …). Bare labels still remap;
 * "Name, Subregion" only remaps when a secondary token is a known country.
 */
const CITY_COLLISION_ALIASES = new Set([
  'holland',
  'hollande',
  'malta',
  'malte',
  'england',
  'angleterre',
  'scotland',
  'ecosse',
  'wales',
  'pays de galles',
  'monaco',
  'luxembourg',
  'andorra',
  'andorre',
]);

/** Country-level tokens used to allow collision aliases with a country secondary. */
const COUNTRY_SECONDARY_HINTS = new Set(
  [
    'united states',
    'united states of america',
    'usa',
    'us',
    'u.s.',
    'u.s.a.',
    'etats-unis',
    'canada',
    'australia',
    'australie',
    'united kingdom',
    'uk',
    'u.k.',
    'great britain',
    'britain',
    'royaume-uni',
    'grande-bretagne',
    'france',
    'germany',
    'allemagne',
    'netherlands',
    'pays-bas',
    'spain',
    'espagne',
    'italy',
    'italie',
    'portugal',
    'ireland',
    'irlande',
    'malta',
    'malte',
    'luxembourg',
    'andorra',
    'andorre',
    'monaco',
    'switzerland',
    'suisse',
    'belgium',
    'belgique',
    'austria',
    'autriche',
    'poland',
    'pologne',
    'europe',
  ].map(lookupKey),
);

/** True when every secondary token is a country hint (e.g. "Scotland, UK"). */
function secondaryOnlyCountryHints(label: string): boolean {
  const parts = label
    .split(/[,|/·•]/)
    .slice(1)
    .map((p) => lookupKey(normalizeAdminToken(p)))
    .filter(Boolean);
  if (!parts.length) return true;
  return parts.every((p) => COUNTRY_SECONDARY_HINTS.has(p));
}

function labelLooksLikeUsCountry(label: string): boolean {
  // lookupKey keeps hyphens: "États-Unis" → "etats-unis" (not "etats unis").
  const full = lookupKey(label);
  return (
    /\bunited states\b/.test(full) ||
    /\bunited states of america\b/.test(full) ||
    /\busa\b/.test(full) ||
    /\bu\.s\.a\b/.test(full) ||
    /\bu\.s\b/.test(full) ||
    /(^|[^a-z])us([^a-z]|$)/.test(full) ||
    /\betats-unis\b/.test(full) ||
    /\betats unis\b/.test(full)
  );
}

function matchAdmin(label: string): { key: string; city: City; id: string } | null {
  // Only the primary place name (before first comma) — never remap
  // "Orlando, Florida" / "Miami, FL" just because the state appears later.
  const parts = label.split(/[,|/·•]/);
  const primary = normalizeAdminToken(parts[0] ?? label);
  if (!primary) return null;
  const hasSecondary = parts.length > 1 && normalizeAdminToken(parts[1] ?? '').length > 0;

  const tryKey = (raw: string): { key: string; city: City; id: string } | null => {
    const key = lookupKey(raw);
    const hit = ADMIN_CITIES[key];
    if (hit) return { key, city: { lat: hit.lat, lon: hit.lon, city: hit.city }, id: hit.id };
    for (const prefix of [
      'state of ',
      'province of ',
      'province de ',
      'etat de ',
      'état de ',
      'commonwealth of ',
      'republic of ',
      'republique de ',
      'république de ',
      'kingdom of ',
      'royaume de ',
      'grand duchy of ',
      'principality of ',
    ]) {
      const nk = lookupKey(raw);
      if (nk.startsWith(lookupKey(prefix))) {
        const rest = nk.slice(lookupKey(prefix).length).trim();
        const nested = ADMIN_CITIES[rest];
        if (nested) {
          return {
            key: rest,
            city: { lat: nested.lat, lon: nested.lon, city: nested.city },
            id: nested.id,
          };
        }
      }
    }
    return null;
  };

  // Prefer US when label secondary mentions USA (disambiguate Georgia vs country).
  // Must run before tryKey — FR "Géorgie" alone maps to Tbilisi.
  const primaryKey = lookupKey(primary);
  if (labelLooksLikeUsCountry(label) && (primaryKey === 'georgia' || primaryKey === 'georgie')) {
    const usGa = ADMIN_CITIES.georgia;
    if (usGa) {
      return { key: 'georgia', city: { lat: usGa.lat, lon: usGa.lon, city: usGa.city }, id: usGa.id };
    }
  }

  const accept = (
    hit: { key: string; city: City; id: string } | null,
  ): { key: string; city: City; id: string } | null => {
    if (!hit) return null;
    // "Holland, Michigan, USA" / "Malta, Montana" — city/state context, not the country.
    // Bare "Holland" or "Scotland, United Kingdom" still remaps.
    if (CITY_COLLISION_ALIASES.has(hit.key) && hasSecondary && !secondaryOnlyCountryHints(label)) {
      return null;
    }
    return hit;
  };

  const direct = accept(tryKey(primary));
  if (direct) return direct;

  return accept(tryKey(normalizeAdminToken(label)));
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
  const { key, city, id } = matched;
  // Already near the city (user picked Vancouver, not BC) — keep coords.
  const dLat = Math.abs(lat - city.lat);
  const dLon = Math.abs(lon - city.lon);
  if (dLat < 0.35 && dLon < 0.35) {
    return { lat, lon, label: label.trim() || city.city, remapped: false, adminKey: id || key };
  }
  const nice = `${city.city} (${label.split(',')[0]?.trim() || key})`;
  return {
    lat: city.lat,
    lon: city.lon,
    label: nice,
    remapped: true,
    adminKey: id || key,
  };
}
