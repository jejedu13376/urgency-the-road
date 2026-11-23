/**
 * Advisory allowed / restricted route rules from trucker profile dims + regs.
 * Not a commercial PTAC / legal clearance graph — OSM/Valhalla advisory only.
 */
import type { TruckerProfile, TrailerType } from '../prefs/truckerProfilePrefs';

export type RouteRuleKind = 'allowed' | 'restricted';

export type RouteRule = {
  id: string;
  kind: RouteRuleKind;
  title: string;
  detail: string;
  /** height | weight | length | width | ban | trailer | equipment */
  basis: 'height' | 'weight' | 'length' | 'width' | 'ban' | 'trailer' | 'equipment' | 'general';
};

export type RouteRulesSummary = {
  profileLabel: string;
  dimsLine: string;
  allowed: RouteRule[];
  restricted: RouteRule[];
  honesty: string;
};

function trailerNote(trailer: TrailerType): { allowed: RouteRule[]; restricted: RouteRule[] } {
  const allowed: RouteRule[] = [];
  const restricted: RouteRule[] = [];
  switch (trailer) {
    case 'flatbed':
      allowed.push({
        id: 'tr-flatbed-ok',
        kind: 'allowed',
        title: 'Corridors plateau / flatbed',
        detail: 'Routes PL standards · attention sangles / bâche par vent fort.',
        basis: 'trailer',
      });
      restricted.push({
        id: 'tr-flatbed-ban',
        kind: 'restricted',
        title: 'Tunnels hauteur basse + vent transversal',
        detail: 'Chargement non bâché : éviter viaducs exposés et tunnels < hauteur profil.',
        basis: 'trailer',
      });
      break;
    case 'tanker':
      allowed.push({
        id: 'tr-tanker-ok',
        kind: 'allowed',
        title: 'Axes citerne autorisés (hors ADR)',
        detail: 'Routes PL hors interdictions locales matières dangereuses.',
        basis: 'trailer',
      });
      restricted.push({
        id: 'tr-tanker-ban',
        kind: 'restricted',
        title: 'Zones résidentielles / tunnels ADR',
        detail: 'Citerne : tunnels classés, centres-villes et bans hazmat à éviter.',
        basis: 'ban',
      });
      break;
    case 'dry_van':
      allowed.push({
        id: 'tr-van-ok',
        kind: 'allowed',
        title: 'Réseau PL classique (dry van)',
        detail: 'Autoroutes / nationales PL — gabarit standard si L/W/H respectés.',
        basis: 'trailer',
      });
      break;
    case 'reefer':
      allowed.push({
        id: 'tr-reefer-ok',
        kind: 'allowed',
        title: 'Corridors frigo / reefer',
        detail: 'Préférer axes avec aires PL (groupe froid / stationnement).',
        basis: 'trailer',
      });
      restricted.push({
        id: 'tr-reefer-ban',
        kind: 'restricted',
        title: 'Longs détours sans aire PL',
        detail: 'Éviter itinéraires sans pause groupe froid si autonomie limitée.',
        basis: 'trailer',
      });
      break;
    case 'livestock':
      allowed.push({
        id: 'tr-live-ok',
        kind: 'allowed',
        title: 'Axes bétail avec aires adaptées',
        detail: 'Préférer corridors avec points d’arrêt / repos animaux.',
        basis: 'trailer',
      });
      restricted.push({
        id: 'tr-live-ban',
        kind: 'restricted',
        title: 'Centres urbains denses & chaleur',
        detail: 'Livestock : éviter embouteillages prolongés et tunnels non ventilés.',
        basis: 'ban',
      });
      break;
    case 'car_carrier':
      restricted.push({
        id: 'tr-car-ban',
        kind: 'restricted',
        title: 'Ponts / tunnels hauteur critique',
        detail: 'Porte-voitures souvent > 4 m — comparer hauteur profil aux maxheight OSM.',
        basis: 'height',
      });
      break;
    case 'lowboy':
      restricted.push({
        id: 'tr-lowboy-ban',
        kind: 'restricted',
        title: 'Passages à niveau / dos-d’âne',
        detail: 'Surbaissée : garde au sol — éviter seuils et rampes abruptes.',
        basis: 'trailer',
      });
      break;
    case 'container':
      allowed.push({
        id: 'tr-box-ok',
        kind: 'allowed',
        title: 'Corridors portuaires / conteneurs',
        detail: 'Axes vers ports / terminaux avec gabarit HC si hauteur OK.',
        basis: 'trailer',
      });
      break;
    case 'tipper':
      restricted.push({
        id: 'tr-tip-ban',
        kind: 'restricted',
        title: 'Zones urbaines banne relevée',
        detail: 'Benne : hauteur en position relevée — ne jamais circuler benne haute.',
        basis: 'height',
      });
      break;
    default:
      break;
  }
  return { allowed, restricted };
}

/**
 * Build advisory allowed / restricted route lists from profile dims + trailer + equipment.
 */
export function buildRouteRulesFromProfile(profile: TruckerProfile): RouteRulesSummary {
  const allowed: RouteRule[] = [];
  const restricted: RouteRule[] = [];
  const { heightM, widthM, lengthM, weightT, axles, region, trailerType, specialEquipment, truckType } =
    profile;

  const profileLabel = [
    truckType === 'trek' ? 'Trek / tracteur' : truckType,
    profile.make || profile.model ? `${profile.make} ${profile.model}`.trim() : null,
    profile.year || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const dimsLine = `L ${lengthM.toFixed(2)} m · W ${widthM.toFixed(2)} m · H ${heightM.toFixed(2)} m · ${weightT.toFixed(1)} t · ${axles} essieux · ${region}`;

  // Baseline PL network
  allowed.push({
    id: 'gen-pl',
    kind: 'allowed',
    title: 'Réseau poids lourd (advisory)',
    detail:
      region === 'NA'
        ? 'Interstates / highways HGV — Valhalla truck + OSM maxheight/maxweight.'
        : region === 'AU'
          ? 'Highways heavy vehicle — mass/height advisory OSM + Valhalla truck.'
          : 'Autoroutes / nationales PL — Valhalla costing truck + alertes gabarit OSM.',
    basis: 'general',
  });

  // Height
  if (heightM > 4.2) {
    restricted.push({
      id: 'h-gt-42',
      kind: 'restricted',
      title: `Hauteur ${heightM.toFixed(2)} m > 4,20 m`,
      detail: 'Beaucoup de ponts / tunnels urbains < 4,2 m — vérifier maxheight avant passage.',
      basis: 'height',
    });
  } else if (heightM > 4.0) {
    restricted.push({
      id: 'h-gt-40',
      kind: 'restricted',
      title: `Hauteur ${heightM.toFixed(2)} m > 4,00 m`,
      detail: 'Ponts bas et parkings interdits — pins OSM NO-PASS si maxheight < profil.',
      basis: 'height',
    });
  } else {
    allowed.push({
      id: 'h-ok',
      kind: 'allowed',
      title: `Hauteur ${heightM.toFixed(2)} m ≤ 4,00 m`,
      detail: 'Gabarit hauteur courant sur axes PL (toujours vérifier tags OSM manquants).',
      basis: 'height',
    });
  }

  // Width
  if (widthM > 2.6) {
    restricted.push({
      id: 'w-gt-26',
      kind: 'restricted',
      title: `Largeur ${widthM.toFixed(2)} m > 2,60 m`,
      detail: 'Convoi / voie étroite — routes étroites et certains tunnels interdits.',
      basis: 'width',
    });
  } else if (widthM > 2.55) {
    restricted.push({
      id: 'w-gt-255',
      kind: 'restricted',
      title: `Largeur ${widthM.toFixed(2)} m > 2,55 m`,
      detail: 'Dépassement largeur standard EU — permis local possible ; éviter centres historiques.',
      basis: 'width',
    });
  } else {
    allowed.push({
      id: 'w-ok',
      kind: 'allowed',
      title: `Largeur ${widthM.toFixed(2)} m ≤ 2,55 m`,
      detail: 'Largeur standard PL — axes HGV usuels.',
      basis: 'width',
    });
  }

  // Length
  if (lengthM > 18.75) {
    restricted.push({
      id: 'l-gt-1875',
      kind: 'restricted',
      title: `Longueur ${lengthM.toFixed(2)} m > 18,75 m`,
      detail: 'Mega / road-train : corridors autorisés seulement — interdictions urbaines fréquentes.',
      basis: 'length',
    });
  } else if (lengthM > 16.5) {
    restricted.push({
      id: 'l-gt-165',
      kind: 'restricted',
      title: `Longueur ${lengthM.toFixed(2)} m > 16,50 m`,
      detail: 'Attelage long — manœuvres / ronds-points serrés à éviter.',
      basis: 'length',
    });
  } else {
    allowed.push({
      id: 'l-ok',
      kind: 'allowed',
      title: `Longueur ${lengthM.toFixed(2)} m ≤ 16,50 m`,
      detail: 'Longueur courante semi EU — réseau PL standard.',
      basis: 'length',
    });
  }

  // Weight
  if (weightT > 44) {
    restricted.push({
      id: 'wt-gt-44',
      kind: 'restricted',
      title: `PTAC ${weightT.toFixed(1)} t > 44 t`,
      detail: 'Hors gabarit masse courant EU — permis / corridors massifs requis (advisory).',
      basis: 'weight',
    });
  } else if (weightT > 40) {
    restricted.push({
      id: 'wt-gt-40',
      kind: 'restricted',
      title: `PTAC ${weightT.toFixed(1)} t > 40 t`,
      detail: 'Ponts maxweight OSM < PTAC → NO-PASS ; préférer axes autoroutiers.',
      basis: 'weight',
    });
  } else {
    allowed.push({
      id: 'wt-ok',
      kind: 'allowed',
      title: `PTAC ${weightT.toFixed(1)} t ≤ 40 t`,
      detail: 'Masse courante — Valhalla truck + alertes maxweight OSM.',
      basis: 'weight',
    });
  }

  if (axles >= 6) {
    restricted.push({
      id: 'ax-6',
      kind: 'restricted',
      title: `${axles} essieux`,
      detail: 'Formules pont / bans locaux possibles — vérifier signalisation juridiction.',
      basis: 'weight',
    });
  }

  // Hazmat / wide load
  if (specialEquipment.includes('hazmat_adr')) {
    restricted.push({
      id: 'eq-hazmat',
      kind: 'restricted',
      title: 'ADR / hazmat — bans tunnels & centres',
      detail: 'Itinéraires matières dangereuses obligatoires ; Valhalla hazmat=true (advisory OSM).',
      basis: 'ban',
    });
    allowed.push({
      id: 'eq-hazmat-ok',
      kind: 'allowed',
      title: 'Axes hazmat autorisés (si signalés)',
      detail: 'Corridors ADR / placarded routes quand tags OSM présents.',
      basis: 'equipment',
    });
  }
  if (specialEquipment.includes('wide_load')) {
    restricted.push({
      id: 'eq-wide',
      kind: 'restricted',
      title: 'Convoi exceptionnel',
      detail: 'Itinéraire & créneau imposés — hors GPS libre ; ne pas suivre un itinéraire auto.',
      basis: 'ban',
    });
  }

  const trailer = trailerNote(trailerType);
  allowed.push(...trailer.allowed);
  restricted.push(...trailer.restricted);

  // Region-specific bans (advisory)
  if (region === 'EU') {
    restricted.push({
      id: 'reg-eu-sun',
      kind: 'restricted',
      title: 'Interdictions PL dimanche / jours fériés (local)',
      detail: 'Certains États EU interdisent PL le dimanche — vérifier pays de transit.',
      basis: 'ban',
    });
  } else if (region === 'NA') {
    restricted.push({
      id: 'reg-na-scale',
      kind: 'restricted',
      title: 'Weigh stations ON / bridge formula',
      detail: 'S’arrêter si station allumée ; formules pont state/province (pas de feed live certifié).',
      basis: 'ban',
    });
  } else if (region === 'AU') {
    restricted.push({
      id: 'reg-au-permit',
      kind: 'restricted',
      title: 'Heavy vehicle permits / mass limits',
      detail: 'Corridors NHVR — masse/hauteur hors gabarit = permis (advisory app).',
      basis: 'ban',
    });
  }

  return {
    profileLabel: profileLabel || 'Profil camion',
    dimsLine,
    allowed,
    restricted,
    honesty:
      'Advisory uniquement — Valhalla truck + tags OSM maxheight/maxweight. Pas de graphe PTAC commercial ni clearance légale certifiée.',
  };
}
