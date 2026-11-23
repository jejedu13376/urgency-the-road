/**
 * OBD BLE scaffold + live session entrypoints.
 *
 * Expo Go limitation: react-native-ble-plx requires a custom Dev Client / bare workflow.
 * This module:
 *  - detects whether a native BLE module is present
 *  - scan / connect (after PoweredOn + Android runtime permissions)
 *  - reuses shared BleManager (never destroy after scan — would kill live session)
 *  - delegates ELM327 AT init + PID/DTC to bleSession (live path)
 *  - never pretends a hardware link succeeded without native BLE
 */
import { getBleCapability } from './bleCapability';
import { ensureAndroidBlePermissions, getSharedBleManager } from './bleNative';

export type { BleCapability } from './bleCapability';
export { getBleCapability };

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
  liveSession?: boolean;
};

export async function scanBleDevices(): Promise<BleScanResult> {
  const cap = getBleCapability();
  if (!cap.available) {
    return {
      ok: false,
      devices: [],
      message: `Scan BLE impossible — ${cap.reason}. ${cap.pathToLive}`,
    };
  }

  // Refuse rescan while a live session owns the radio — disconnect first intentionally.
  const { getActiveBleSession } = await import('./bleSession');
  if (getActiveBleSession()) {
    return {
      ok: false,
      devices: [],
      message: 'Session ELM live ouverte — déconnectez la valise avant un nouveau scan.',
    };
  }

  const perm = await ensureAndroidBlePermissions();
  if (!perm.ok) {
    return { ok: false, devices: [], message: perm.message ?? 'Permissions Bluetooth manquantes.' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manager: any = await getSharedBleManager();
    const found: { id: string; name: string }[] = [];
    await new Promise<void>((resolve) => {
      const sub = manager.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error: Error | null, device: { id: string; name?: string | null; localName?: string | null } | null) => {
          if (error) {
            try {
              sub?.remove?.();
            } catch {
              /* ignore */
            }
            resolve();
            return;
          }
          const name = device?.name || device?.localName || '';
          if (device && name && /obd|elm|vgate|obdlink|veepaa|nexion|j1939|plx|carista/i.test(name)) {
            if (!found.some((d) => d.id === device.id)) {
              found.push({ id: device.id, name });
            }
          }
        },
      );
      setTimeout(() => {
        try {
          manager.stopDeviceScan();
        } catch {
          /* ignore */
        }
        try {
          sub?.remove?.();
        } catch {
          /* ignore */
        }
        resolve();
      }, 5000);
    });
    // Do NOT destroy shared BleManager here — native client is singleton.
    return {
      ok: true,
      devices: found,
      message: found.length ? `${found.length} appareil(s) OBD trouvé(s)` : 'Aucun OBD nommé détecté (5s)',
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
  if (deviceId.startsWith('mock-')) {
    return {
      ok: true,
      connected: true,
      deviceId,
      message: `Connecté (mock UI) à ${deviceId} — pas de session ELM hardware.`,
      liveSession: false,
    };
  }
  // Live path: connect + ELM init (default OBD2; screen may re-init with J1939)
  const { connectAndInitElm } = await import('./bleSession');
  const r = await connectAndInitElm(deviceId, 'OBD2');
  return {
    ok: r.ok,
    connected: r.ok,
    deviceId,
    message: r.message,
    liveSession: r.ok,
  };
}

export function bleStatusLabel(): string {
  const c = getBleCapability();
  return c.available ? 'BLE natif prêt — chemin ELM327/J1939 live' : `OBD BLE stub — ${c.reason}`;
}

export {
  connectAndInitElm,
  disconnectBleSession,
  getActiveBleSession,
  readLiveObdSnapshot,
} from './bleSession';
