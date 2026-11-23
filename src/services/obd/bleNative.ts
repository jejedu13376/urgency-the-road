/**
 * Shared native BLE helpers (PoweredOn wait + Android 12+ runtime permissions).
 * Soft-used only when react-native-ble-plx is present (Dev Client).
 *
 * BleManager is a native singleton — create once, never destroy after a scan
 * (destroy would kill any live GATT session).
 */
import { PermissionsAndroid, Platform } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharedManager: any = null;

/** Wait until BleManager reports PoweredOn (required after create / after adapter toggle). */
export async function waitForBlePoweredOn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manager: any,
  timeoutMs = 12000,
): Promise<void> {
  try {
    const current = await manager.state();
    if (current === 'PoweredOn') return;
  } catch {
    /* fall through to listener */
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sub: { remove?: () => void } | null = null;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        sub?.remove?.();
      } catch {
        /* ignore */
      }
      reject(new Error('Bluetooth non prêt (attente PoweredOn expirée).'));
    }, timeoutMs);

    try {
      sub = manager.onStateChange((state: string) => {
        if (state !== 'PoweredOn' || settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          sub?.remove?.();
        } catch {
          /* ignore */
        }
        resolve();
      }, true);
    } catch (e) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error('onStateChange indisponible'));
      }
    }
  });
}

/** Process-wide BleManager — do not destroy between scan/connect (singleton native client). */
export async function getSharedBleManager(): Promise<unknown> {
  if (!sharedManager) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager } = require('react-native-ble-plx');
    sharedManager = new BleManager();
  }
  await waitForBlePoweredOn(sharedManager);
  return sharedManager;
}

/**
 * Request Android BLE runtime permissions.
 * API 31+ with app.json `neverForLocation: true`: only BLUETOOTH_SCAN + BLUETOOTH_CONNECT.
 * API < 31: ACCESS_FINE_LOCATION (legacy scan requirement).
 */
export async function ensureAndroidBlePermissions(): Promise<{ ok: boolean; message?: string }> {
  if (Platform.OS !== 'android') return { ok: true };

  const api =
    typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);

  try {
    if (api >= 31) {
      // Matches react-native-ble-plx plugin neverForLocation: true — no location needed to scan.
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      const scanOk = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'granted';
      const connectOk = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted';
      if (!scanOk || !connectOk) {
        return {
          ok: false,
          message: 'Permissions Bluetooth refusées (BLUETOOTH_SCAN / BLUETOOTH_CONNECT requis Android 12+).',
        };
      }
      return { ok: true };
    }

    const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Localisation pour scan BLE',
      message: 'Android < 12 requiert la localisation pour découvrir les valises OBD en Bluetooth.',
      buttonPositive: 'Autoriser',
      buttonNegative: 'Refuser',
    });
    if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
      return { ok: false, message: 'Permission localisation refusée — scan BLE impossible.' };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Échec demande permissions Bluetooth',
    };
  }
}

/**
 * True when an AT/init reply means the adapter did not come up.
 * ATZ: TIMEOUT alone is not a hard fail (reset is slow over BLE) — ERROR/NO DATA still are.
 */
export function isElmInitFailure(resp: string, cmd?: string): boolean {
  const t = resp.trim().toUpperCase();
  const isAtz = (cmd ?? '').trim().toUpperCase() === 'ATZ';
  if (!t) return !isAtz;
  if (t === 'NO_SESSION' || t === 'DISCONNECTED') return true;
  if (t === 'TIMEOUT') return !isAtz;
  if (t.includes('NO DATA')) return true;
  if (/\bERROR\b/.test(t)) return true;
  if (t.includes('UNABLE TO CONNECT')) return true;
  return false;
}

/** Prefer ~3.5s wait for ATZ; shorter for other AT commands. */
export function atInitWaitMs(cmd: string): number {
  return cmd.trim().toUpperCase() === 'ATZ' ? 3500 : 1200;
}
