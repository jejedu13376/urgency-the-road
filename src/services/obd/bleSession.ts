/**
 * Live BLE OBD session (ELM327 GATT + J1939-capable adapters).
 * Soft-depends on react-native-ble-plx (Dev Client). Expo Go → capability false.
 */
import type { ObdProtocol } from '../../types/firestore';
import {
  ELM327_INIT_AT,
  J1939_INIT_AT,
  emptyPidSnapshot,
  encodeElmCommand,
  parseEct,
  parseMap,
  parseMode03Dtcs,
  parseRpm,
  parseVoltage,
  type ParsedDtc,
  type PidSnapshot,
} from './elm327Protocol';
import { getBleCapability } from './bleCapability';

/** Common ELM327 UART-over-BLE service/characteristic UUIDs (FFE0/FFE1 family). */
const UART_SERVICE_CANDIDATES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
];
const UART_CHAR_CANDIDATES = [
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000fff1-0000-1000-8000-00805f9b34fb',
];

export type LiveObdReading = {
  connected: true;
  deviceId: string;
  protocol: ObdProtocol;
  sensors: PidSnapshot;
  dtcCodes: ParsedDtc[];
  rawLog: string[];
  source: 'ble-elm327';
};

type SessionState = {
  deviceId: string;
  protocol: ObdProtocol;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manager: any;
  writeUuid: string;
  serviceUuid: string;
  notifyBuf: string;
};

let session: SessionState | null = null;

export function getActiveBleSession(): { deviceId: string; protocol: ObdProtocol } | null {
  return session ? { deviceId: session.deviceId, protocol: session.protocol } : null;
}

export async function disconnectBleSession(): Promise<void> {
  if (!session) return;
  try {
    await session.manager.cancelDeviceConnection(session.deviceId);
  } catch {
    /* ignore */
  }
  session = null;
}

/**
 * Connect + discover UART char + run AT init for OBD2 or J1939-style adapters.
 */
export async function connectAndInitElm(
  deviceId: string,
  protocol: ObdProtocol,
): Promise<{ ok: boolean; message: string }> {
  const cap = getBleCapability();
  if (!cap.available) {
    return { ok: false, message: `BLE natif absent — ${cap.pathToLive}` };
  }
  if (deviceId.startsWith('mock-')) {
    return { ok: false, message: 'Appareil mock — pas de session BLE hardware.' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager } = require('react-native-ble-plx');
    const manager = new BleManager();
    await manager.connectToDevice(deviceId, { timeout: 10000 });
    await manager.discoverAllServicesAndCharacteristicsForDevice(deviceId);

    const services = await manager.servicesForDevice(deviceId);
    let serviceUuid = '';
    let writeUuid = '';
    for (const svc of services) {
      const su = String(svc.uuid).toLowerCase();
      if (!UART_SERVICE_CANDIDATES.some((c) => su.includes(c.slice(4, 8)))) {
        // still probe all chars
      }
      const chars = await manager.characteristicsForDevice(deviceId, svc.uuid);
      for (const ch of chars) {
        const cu = String(ch.uuid).toLowerCase();
        const isCandidate =
          UART_CHAR_CANDIDATES.some((c) => cu.includes(c.slice(4, 8))) ||
          ch.isWritableWithResponse ||
          ch.isWritableWithoutResponse;
        if (isCandidate && (ch.isWritableWithResponse || ch.isWritableWithoutResponse)) {
          serviceUuid = svc.uuid;
          writeUuid = ch.uuid;
          break;
        }
      }
      if (writeUuid) break;
    }

    if (!writeUuid) {
      await manager.cancelDeviceConnection(deviceId);
      return {
        ok: false,
        message:
          'Connecté mais aucune caractéristique UART ELM (FFE1) trouvée — adapter non supporté ou pairing requis.',
      };
    }

    session = {
      deviceId,
      protocol,
      manager,
      writeUuid,
      serviceUuid,
      notifyBuf: '',
    };

    // Monitor notifications if available
    try {
      manager.monitorCharacteristicForDevice(
        deviceId,
        serviceUuid,
        writeUuid,
        (_err: Error | null, characteristic: { value?: string | null } | null) => {
          if (!session || !characteristic?.value) return;
          const decoded = base64ToAscii(characteristic.value);
          session.notifyBuf += decoded;
        },
      );
    } catch {
      /* some adapters are write+read only */
    }

    const init = protocol === 'J1939' || protocol === 'J1708' ? J1939_INIT_AT : ELM327_INIT_AT;
    const log: string[] = [];
    for (const at of init) {
      const resp = await writeAndAwait(at, 1200);
      log.push(`${at} → ${resp.slice(0, 80)}`);
    }

    return {
      ok: true,
      message: `Valise BLE connectée (${deviceId.slice(0, 8)}…) · init ${protocol} OK · ${log.length} AT`,
    };
  } catch (e) {
    session = null;
    return { ok: false, message: e instanceof Error ? e.message : 'Échec connectAndInitElm' };
  }
}

/** Live PID + Mode 03 DTC read over open session. */
export async function readLiveObdSnapshot(protocol?: ObdProtocol): Promise<LiveObdReading | null> {
  if (!session) return null;
  const proto = protocol ?? session.protocol;
  const rawLog: string[] = [];
  const sensors = emptyPidSnapshot();

  const rpmRaw = await writeAndAwait('010C', 1500);
  rawLog.push(rpmRaw);
  sensors.rpm = parseRpm(rpmRaw) ?? 0;

  const ectRaw = await writeAndAwait('0105', 1200);
  rawLog.push(ectRaw);
  sensors.ectC = parseEct(ectRaw) ?? 0;

  const mapRaw = await writeAndAwait('010B', 1200);
  rawLog.push(mapRaw);
  sensors.mapKpa = parseMap(mapRaw) ?? 0;

  const voltRaw = await writeAndAwait('0142', 1200);
  rawLog.push(voltRaw);
  sensors.batV = parseVoltage(voltRaw) ?? 0;

  const dtcRaw = await writeAndAwait('03', 2000);
  rawLog.push(dtcRaw);
  let dtcCodes = parseMode03Dtcs(dtcRaw);

  if (proto === 'J1939' || proto === 'J1708') {
    // Many consumer BLE PL bridges still return ELM-style; annotate if empty
    if (!dtcCodes.length) {
      dtcCodes = [
        {
          code: 'SPN—',
          plainLanguage:
            'Session J1939 ouverte — DM1/SPN non décodés sur cet adaptateur (étendre mapping SPN/FMI).',
          severity: 'info',
        },
      ];
    }
  }

  return {
    connected: true,
    deviceId: session.deviceId,
    protocol: proto,
    sensors,
    dtcCodes,
    rawLog,
    source: 'ble-elm327',
  };
}

async function writeAndAwait(cmd: string, waitMs: number): Promise<string> {
  if (!session) return 'NO_SESSION';
  session.notifyBuf = '';
  const payload = toBase64(encodeElmCommand(cmd));
  try {
    await session.manager.writeCharacteristicWithResponseForDevice(
      session.deviceId,
      session.serviceUuid,
      session.writeUuid,
      payload,
    );
  } catch {
    await session.manager.writeCharacteristicWithoutResponseForDevice(
      session.deviceId,
      session.serviceUuid,
      session.writeUuid,
      payload,
    );
  }
  await sleep(waitMs);
  if (session.notifyBuf.trim()) return session.notifyBuf;
  // Fallback read
  try {
    const ch = await session.manager.readCharacteristicForDevice(
      session.deviceId,
      session.serviceUuid,
      session.writeUuid,
    );
    if (ch?.value) return base64ToAscii(ch.value);
  } catch {
    /* ignore */
  }
  return session.notifyBuf || 'TIMEOUT';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function toBase64(ascii: string): string {
  // React Native global
  if (typeof btoa === 'function') return btoa(ascii);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Buffer } = require('buffer');
  return Buffer.from(ascii, 'utf8').toString('base64');
}

function base64ToAscii(b64: string): string {
  if (typeof atob === 'function') return atob(b64);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Buffer } = require('buffer');
  return Buffer.from(b64, 'base64').toString('utf8');
}
