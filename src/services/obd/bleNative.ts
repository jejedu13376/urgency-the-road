/**
 * Shared native BLE helpers (PoweredOn wait + Android 12+ runtime permissions).
 * Soft-used only when react-native-ble-plx is present (Dev Client).
 */
import { PermissionsAndroid, Platform } from 'react-native';

/** Wait until BleManager reports PoweredOn (required after create / after destroy+recreate). */
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

/** Request Android BLE runtime permissions (SCAN/CONNECT on API 31+, location on older). */
export async function ensureAndroidBlePermissions(): Promise<{ ok: boolean; message?: string }> {
  if (Platform.OS !== 'android') return { ok: true };

  const api =
    typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);

  try {
    if (api >= 31) {
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

/** True when an AT/init reply means the adapter did not come up. */
export function isElmInitFailure(resp: string): boolean {
  const t = resp.trim().toUpperCase();
  if (!t) return true;
  if (t === 'TIMEOUT' || t === 'NO_SESSION' || t === 'DISCONNECTED') return true;
  if (t.includes('NO DATA')) return true;
  if (/\bERROR\b/.test(t)) return true;
  if (t.includes('UNABLE TO CONNECT')) return true;
  return false;
}
