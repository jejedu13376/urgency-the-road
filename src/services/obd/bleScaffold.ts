/**
 * OBD BLE scaffold.
 *
 * Expo Go limitation: react-native-ble-plx requires a custom Dev Client / bare workflow.
 * This module:
 *  - detects whether a native BLE module is present
 *  - exposes a clear connect path + mock snapshot fallback
 *  - never pretends a hardware link succeeded without native BLE
 */

export type BleCapability = {
  available: boolean;
  reason: string;
  pathToLive: string;
};

export type BleScanResult = {
  ok: boolean;
  devices: { id: string; name: string }[];
  message: string;
};

export type BleConnectResult = {
  ok: boolean;
  connected: boolean;
  deviceId?: string;
  message: string;
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
        pathToLive: 'Utiliser scanBleDevices() / connectBleDevice() sur Dev Client.',
      };
    }
  } catch {
    /* Expo Go / web */
  }
  return {
    available: false,
    reason: 'BLE natif absent (Expo Go / web)',
    pathToLive:
      '1) eas build --profile development  2) npm i react-native-ble-plx  3) permissions BLUETOOTH_* / NSBluetooth  4) reconnecter valise OBD2/ELM327',
  };
}

export async function scanBleDevices(): Promise<BleScanResult> {
  const cap = getBleCapability();
  if (!cap.available) {
    return {
      ok: false,
      devices: [],
      message: `Scan BLE impossible — ${cap.reason}. ${cap.pathToLive}`,
    };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager } = require('react-native-ble-plx');
    const manager = new BleManager();
    const found: { id: string; name: string }[] = [];
    await new Promise<void>((resolve) => {
      const sub = manager.startDeviceScan(
        null,
        null,
        (error: Error | null, device: { id: string; name?: string | null } | null) => {
          if (error) {
            sub?.remove?.();
            resolve();
            return;
          }
          if (device?.name && /obd|elm|vgate|obdlink/i.test(device.name)) {
            if (!found.some((d) => d.id === device.id)) {
              found.push({ id: device.id, name: device.name });
            }
          }
        },
      );
      setTimeout(() => {
        manager.stopDeviceScan();
        sub?.remove?.();
        resolve();
      }, 4000);
    });
    return {
      ok: true,
      devices: found,
      message: found.length ? `${found.length} appareil(s) OBD trouvé(s)` : 'Aucun OBD nommé détecté (4s)',
    };
  } catch (e) {
    return {
      ok: false,
      devices: [],
      message: e instanceof Error ? e.message : 'Erreur scan BLE',
    };
  }
}

export async function connectBleDevice(deviceId: string): Promise<BleConnectResult> {
  const cap = getBleCapability();
  if (!cap.available) {
    return {
      ok: false,
      connected: false,
      message: `Connexion BLE impossible — ${cap.reason}. ${cap.pathToLive}`,
    };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager } = require('react-native-ble-plx');
    const manager = new BleManager();
    await manager.connectToDevice(deviceId);
    await manager.discoverAllServicesAndCharacteristicsForDevice(deviceId);
    return {
      ok: true,
      connected: true,
      deviceId,
      message: `Connecté à ${deviceId} — lecture DTC ELM327 à brancher (ATZ/0100).`,
    };
  } catch (e) {
    return {
      ok: false,
      connected: false,
      deviceId,
      message: e instanceof Error ? e.message : 'Échec connexion BLE',
    };
  }
}

export function bleStatusLabel(): string {
  const c = getBleCapability();
  return c.available ? 'BLE natif prêt' : `OBD BLE stub — ${c.reason}`;
}
