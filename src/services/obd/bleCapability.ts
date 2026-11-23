export type BleCapability = {
  available: boolean;
  reason: string;
  pathToLive: string;
};

/** Soft probe — no hard dependency on ble-plx so Expo Go still boots. */
export function getBleCapability(): BleCapability {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-ble-plx');
    if (mod?.BleManager) {
      return {
        available: true,
        reason: 'react-native-ble-plx détecté',
        pathToLive: 'Scan → Connecter → init ELM327/J1939 → lecture DTC live.',
      };
    }
  } catch {
    /* Expo Go / web */
  }
  return {
    available: false,
    reason: 'BLE natif absent (Expo Go / web)',
    pathToLive:
      '1) eas build -p android --profile development  2) npm i react-native-ble-plx  3) permissions BLUETOOTH_*  4) reconnecter valise ELM327/J1939',
  };
}
