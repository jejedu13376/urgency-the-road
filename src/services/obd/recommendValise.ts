/**
 * Module 5 — after VIN / vehicle profile, recommend OBD port + valise type.
 * Subscriber buys the hardware (not the publisher). Print/fulfillment later.
 */
import type { VehicleProfile } from '../../types/vehicle';
import type { ObdProtocol } from '../../types/firestore';

export type ObdConnectorKind = 'obd2_16pin' | 'j1939_9pin' | 'j1708_6pin' | 'oem_round';

export type ObdValiseRecommendation = {
  vehicleLabel: string;
  vin?: string;
  connector: {
    kind: ObdConnectorKind;
    label: string;
    locationHint: string;
    pins: string;
  };
  protocols: ObdProtocol[];
  recommendedProtocol: ObdProtocol;
  valise: {
    skuLabel: string;
    type: string;
    why: string;
    interfaces: ('Bluetooth' | 'Wi-Fi' | 'USB')[];
  };
  buySearchQuery: string;
  buyUrl: string;
  disclaimer: string;
};

function isHeavyDuty(v: VehicleProfile | null | undefined): boolean {
  if (!v) return false;
  return (
    v.vehicleClass === 'poids_lourd' ||
    v.powertrain === 'poids_lourd_diesel' ||
    Boolean(v.vin?.toUpperCase().startsWith('WDB') || v.vin?.toUpperCase().startsWith('1FU'))
  );
}

/** Recommend connector + valise from decoded VIN / fleet vehicle. */
export function recommendValiseForVehicle(vehicle: VehicleProfile | null): ObdValiseRecommendation | null {
  if (!vehicle) return null;

  const label = `${vehicle.make} ${vehicle.model} ${vehicle.year}`.trim();
  const heavy = isHeavyDuty(vehicle);
  const eu = vehicle.continent === 'EU';

  if (heavy) {
    const query = encodeURIComponent(
      `valise diagnostic camion J1939 9 broches Bluetooth ${vehicle.make} ${vehicle.model}`,
    );
    return {
      vehicleLabel: label,
      vin: vehicle.vin,
      connector: {
        kind: 'j1939_9pin',
        label: 'Prise diagnostic poids lourd SAE J1939 (9 broches)',
        locationHint:
          'Souvent côté conducteur / console / sous tableau — vérifier manuel PL. Adaptateur 9→16 pins si besoin.',
        pins: '9 broches (Deutsch / type PL)',
      },
      protocols: ['J1939', 'J1708'],
      recommendedProtocol: 'J1939',
      valise: {
        skuLabel: 'Boîtier PL J1939 / J1708 (Bluetooth ou USB)',
        type: 'Valise / dongle poids lourd',
        why: 'Ce véhicule est classé poids lourd — OBD2 16 broches voiture ne suffit pas pour J1939/DM1.',
        interfaces: ['Bluetooth', 'USB'],
      },
      buySearchQuery: decodeURIComponent(query),
      buyUrl: `https://www.amazon.fr/s?k=${query}`,
      disclaimer:
        'L’éditeur ne fournit pas la valise. L’abonné commande et paie lui-même le boîtier recommandé.',
    };
  }

  const protocol: ObdProtocol = eu ? 'EOBD' : 'OBD2';
  const query = encodeURIComponent(
    `ELM327 OBD2 Bluetooth ${vehicle.make} ${vehicle.model} ${vehicle.year}`,
  );
  return {
    vehicleLabel: label,
    vin: vehicle.vin,
    connector: {
      kind: 'obd2_16pin',
      label: eu ? 'Prise EOBD / OBD2 16 broches' : 'Prise OBD2 16 broches',
      locationHint:
        'Sous le tableau de bord côté conducteur (souvent près de la pédale / boîte à fusibles).',
      pins: '16 broches (SAE J1962)',
    },
    protocols: eu ? ['EOBD', 'OBD2'] : ['OBD2', 'EOBD'],
    recommendedProtocol: protocol,
    valise: {
      skuLabel: 'Dongle ELM327 / OBDLink classe OBD2 (Bluetooth ou Wi-Fi)',
      type: 'Boîtier OBD2 voiture / pick-up / SUV',
      why: 'Véhicule léger — prise 16 broches standard + protocole OBD2/EOBD.',
      interfaces: ['Bluetooth', 'Wi-Fi'],
    },
    buySearchQuery: decodeURIComponent(query),
    buyUrl: `https://www.amazon.fr/s?k=${query}`,
    disclaimer:
      'L’éditeur ne fournit pas la valise. L’abonné commande et paie lui-même le boîtier recommandé après VIN.',
  };
}
