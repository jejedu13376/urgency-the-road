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
const UART_SERVICE_MARKERS = ['ffe0', 'fff0'];
const UART_CHAR_MARKERS = ['ffe1', 'fff1'];

export type LiveObdReading = {
  connected: true;
  deviceId: string;
  protocol: ObdProtocol;
  sensors: PidSnapshot;
  dtcCodes: ParsedDtc[];
  rawLog: string[];
  source: 'ble-elm327';
  parseWarnings: string[];
};

type SessionState = {
  id: number;
  deviceId: string;
  protocol: ObdProtocol;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manager: any;
  writeUuid: string;
  serviceUuid: string;
  notifyBuf: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  monitorSub: { remove?: () => void } | null;
};

let session: SessionState | null = null;
let sessionSeq = 0;
let ioLock: Promise<void> = Promise.resolve();

function withIoLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = ioLock.then(fn, fn);
  ioLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function getActiveBleSession(): { deviceId: string; protocol: ObdProtocol } | null {
  return session ? { deviceId: session.deviceId, protocol: session.protocol } : null;
}

export async function disconnectBleSession(): Promise<void> {
  await withIoLock(async () => {
    const cur = session;
    session = null;
    if (!cur) return;
    try {
      cur.monitorSub?.remove?.();
    } catch {
      /* ignore */
    }
    try {
      await cur.manager.cancelDeviceConnection(cur.deviceId);
    } catch {
      /* ignore */
    }
    try {
      cur.manager.destroy?.();
    } catch {
      /* ignore */
    }
  });
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

  // Tear down any prior session before opening a new one (prevents leak / already-connected).
  await disconnectBleSession();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let manager: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager } = require('react-native-ble-plx');
    manager = new BleManager();
    await manager.connectToDevice(deviceId, { timeout: 10000 });
    await manager.discoverAllServicesAndCharacteristicsForDevice(deviceId);

    const services = await manager.servicesForDevice(deviceId);
    const preferred = services.filter((svc: { uuid: string }) =>
      UART_SERVICE_MARKERS.some((m) => String(svc.uuid).toLowerCase().includes(m)),
    );
    const searchOrder = preferred.length ? preferred : services;

    let serviceUuid = '';
    let writeUuid = '';

    for (const svc of searchOrder) {
      const chars = await manager.characteristicsForDevice(deviceId, svc.uuid);
      // Prefer known ELM UART chars first
      const sorted = [...chars].sort((a: { uuid: string }, b: { uuid: string }) => {
        const score = (u: string) => (UART_CHAR_MARKERS.some((m) => u.toLowerCase().includes(m)) ? 0 : 1);
        return score(String(a.uuid)) - score(String(b.uuid));
      });
      for (const ch of sorted) {
        const cu = String(ch.uuid).toLowerCase();
        const isElmChar = UART_CHAR_MARKERS.some((m) => cu.includes(m));
        const writable = ch.isWritableWithResponse || ch.isWritableWithoutResponse;
        if (!writable) continue;
        // If we are on a preferred UART service, accept writable; else require ELM marker
        const onPreferredSvc = preferred.length > 0;
        if (onPreferredSvc || isElmChar) {
          serviceUuid = svc.uuid;
          writeUuid = ch.uuid;
          break;
        }
      }
      if (writeUuid) break;
    }

    if (!writeUuid) {
      try {
        await manager.cancelDeviceConnection(deviceId);
      } catch {
        /* ignore */
      }
      try {
        manager.destroy?.();
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        message:
          'Connecté mais aucune caractéristique UART ELM (FFE0/FFE1) trouvée — adapter non supporté ou pairing requis.',
      };
    }

    const id = ++sessionSeq;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let monitorSub: { remove?: () => void } | null = null;

    session = {
      id,
      deviceId,
      protocol,
      manager,
      writeUuid,
      serviceUuid,
      notifyBuf: '',
      monitorSub: null,
    };

    try {
      monitorSub = manager.monitorCharacteristicForDevice(
        deviceId,
        serviceUuid,
        writeUuid,
        (_err: Error | null, characteristic: { value?: string | null } | null) => {
          if (!session || session.id !== id || !characteristic?.value) return;
          session.notifyBuf += base64ToAscii(characteristic.value);
        },
      );
      if (session) session.monitorSub = monitorSub;
    } catch {
      /* some adapters are write+read only */
    }

    const init = protocol === 'J1939' || protocol === 'J1708' ? J1939_INIT_AT : ELM327_INIT_AT;
    const log: string[] = [];
    for (const at of init) {
      const resp = await writeAndAwait(at, 1200);
      log.push(`${at} → ${resp.slice(0, 80)}`);
    }

    if (!session || session.id !== id) {
      return { ok: false, message: 'Session interrompue pendant l’init AT.' };
    }

    return {
      ok: true,
      message: `Valise BLE connectée (${deviceId.slice(0, 8)}…) · init ${protocol} OK · ${log.length} AT`,
    };
  } catch (e) {
    // Ensure hardware link is cancelled on failure (no stale already-connected).
    if (manager) {
      try {
        await manager.cancelDeviceConnection(deviceId);
      } catch {
        /* ignore */
      }
      try {
        manager.destroy?.();
      } catch {
        /* ignore */
      }
    }
    if (session?.deviceId === deviceId) session = null;
    return { ok: false, message: e instanceof Error ? e.message : 'Échec connectAndInitElm' };
  }
}

/** Live PID + Mode 03 DTC read over open session. Failed parses stay null (not 0). */
export async function readLiveObdSnapshot(protocol?: ObdProtocol): Promise<LiveObdReading | null> {
  return withIoLock(async () => {
    if (!session) return null;
    const snapSession = session;
    const proto = protocol ?? snapSession.protocol;
    const rawLog: string[] = [];
    const parseWarnings: string[] = [];
    const sensors = emptyPidSnapshot();

    const rpmRaw = await writeAndAwait('010C', 1500);
    if (!session || session.id !== snapSession.id) return null;
    rawLog.push(rpmRaw);
    sensors.rpm = parseRpm(rpmRaw);
    if (sensors.rpm === null) parseWarnings.push('RPM indisponible (timeout / réponse non ELM)');

    const ectRaw = await writeAndAwait('0105', 1200);
    if (!session || session.id !== snapSession.id) return null;
    rawLog.push(ectRaw);
    sensors.ectC = parseEct(ectRaw);
    if (sensors.ectC === null) parseWarnings.push('Temp. eau indisponible');

    const mapRaw = await writeAndAwait('010B', 1200);
    if (!session || session.id !== snapSession.id) return null;
    rawLog.push(mapRaw);
    sensors.mapKpa = parseMap(mapRaw);
    if (sensors.mapKpa === null) parseWarnings.push('MAP indisponible');

    const voltRaw = await writeAndAwait('0142', 1200);
    if (!session || session.id !== snapSession.id) return null;
    rawLog.push(voltRaw);
    sensors.batV = parseVoltage(voltRaw);
    if (sensors.batV === null) parseWarnings.push('Tension module indisponible');

    const dtcRaw = await writeAndAwait('03', 2000);
    if (!session || session.id !== snapSession.id) return null;
    rawLog.push(dtcRaw);
    let dtcCodes = parseMode03Dtcs(dtcRaw);

    if (proto === 'J1939' || proto === 'J1708') {
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
      deviceId: snapSession.deviceId,
      protocol: proto,
      sensors,
      dtcCodes,
      rawLog,
      source: 'ble-elm327',
      parseWarnings,
    };
  });
}

async function writeAndAwait(cmd: string, waitMs: number): Promise<string> {
  const cur = session;
  if (!cur) return 'NO_SESSION';
  const sid = cur.id;
  cur.notifyBuf = '';
  const payload = toBase64(encodeElmCommand(cmd));
  try {
    await cur.manager.writeCharacteristicWithResponseForDevice(
      cur.deviceId,
      cur.serviceUuid,
      cur.writeUuid,
      payload,
    );
  } catch {
    if (!session || session.id !== sid) return 'DISCONNECTED';
    await cur.manager.writeCharacteristicWithoutResponseForDevice(
      cur.deviceId,
      cur.serviceUuid,
      cur.writeUuid,
      payload,
    );
  }
  await sleep(waitMs);
  // Session may have been cleared by disconnect during wait
  if (!session || session.id !== sid) return 'DISCONNECTED';
  if (session.notifyBuf.trim()) return session.notifyBuf;
  try {
    const ch = await session.manager.readCharacteristicForDevice(
      session.deviceId,
      session.serviceUuid,
      session.writeUuid,
    );
    if (!session || session.id !== sid) return 'DISCONNECTED';
    if (ch?.value) return base64ToAscii(ch.value);
  } catch {
    /* ignore */
  }
  if (!session || session.id !== sid) return 'DISCONNECTED';
  return session.notifyBuf || 'TIMEOUT';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function toBase64(ascii: string): string {
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
