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
import {
  atInitWaitMs,
  ensureAndroidBlePermissions,
  getSharedBleManager,
  isElmInitFailure,
} from './bleNative';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  disconnectSub: { remove?: () => void } | null;
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

/** Tear down a session without taking the IO lock (caller must already hold it). */
async function teardownUnlocked(cur: SessionState | null): Promise<void> {
  if (!cur) return;
  try {
    cur.disconnectSub?.remove?.();
  } catch {
    /* ignore */
  }
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
  // Never destroy shared BleManager — native client is a singleton; destroy kills live/scans.
}

async function releaseAttempt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manager: any,
  deviceId: string,
  monitorSub: { remove?: () => void } | null,
  disconnectSub: { remove?: () => void } | null = null,
): Promise<void> {
  try {
    disconnectSub?.remove?.();
  } catch {
    /* ignore */
  }
  try {
    monitorSub?.remove?.();
  } catch {
    /* ignore */
  }
  if (!manager) return;
  try {
    await manager.cancelDeviceConnection(deviceId);
  } catch {
    /* ignore */
  }
}

/** Clear global session for this attempt id when the link drops (monitor err / disconnect). */
function clearSessionIfId(id: number): void {
  void withIoLock(async () => {
    if (session?.id !== id) return;
    const cur = session;
    session = null;
    if (!cur) return;
    try {
      cur.disconnectSub?.remove?.();
    } catch {
      /* ignore */
    }
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
  });
}

export function getActiveBleSession(): { deviceId: string; protocol: ObdProtocol } | null {
  return session ? { deviceId: session.deviceId, protocol: session.protocol } : null;
}

export async function disconnectBleSession(): Promise<void> {
  await withIoLock(async () => {
    const cur = session;
    session = null;
    await teardownUnlocked(cur);
  });
}

/**
 * After a failed device switch, try to bring the prior GATT/ELM session back.
 * Best-effort: if restore fails, leave `session` null (never leave an untracked live link).
 */
async function restorePriorSession(prior: SessionState): Promise<boolean> {
  let manager: any = null;
  let monitorSub: { remove?: () => void } | null = null;
  let disconnectSub: { remove?: () => void } | null = null;
  const id = ++sessionSeq;
  const { deviceId, protocol, serviceUuid, writeUuid } = prior;

  try {
    manager = await getSharedBleManager();
    await manager.connectToDevice(deviceId, { timeout: 10000 });
    await manager.discoverAllServicesAndCharacteristicsForDevice(deviceId);

    const pending: SessionState = {
      id,
      deviceId,
      protocol,
      manager,
      writeUuid,
      serviceUuid,
      notifyBuf: '',
      monitorSub: null,
      disconnectSub: null,
    };

    try {
      disconnectSub = manager.onDeviceDisconnected(deviceId, () => {
        clearSessionIfId(id);
      });
      pending.disconnectSub = disconnectSub;
    } catch {
      /* optional */
    }

    try {
      monitorSub = manager.monitorCharacteristicForDevice(
        deviceId,
        serviceUuid,
        writeUuid,
        (err: Error | null, characteristic: { value?: string | null } | null) => {
          if (err) {
            clearSessionIfId(id);
            return;
          }
          if (!characteristic?.value) return;
          if (session && session.id !== id) return;
          pending.notifyBuf += base64ToAscii(characteristic.value);
        },
      );
      pending.monitorSub = monitorSub;
    } catch {
      /* write+read only */
    }

    const init = protocol === 'J1939' || protocol === 'J1708' ? J1939_INIT_AT : ELM327_INIT_AT;
    for (const at of init) {
      const resp = await writeAndAwait(at, atInitWaitMs(at), pending);
      if (isElmInitFailure(resp, at)) {
        await releaseAttempt(manager, deviceId, monitorSub, disconnectSub);
        return false;
      }
    }

    session = pending;
    return true;
  } catch {
    await releaseAttempt(manager, deviceId, monitorSub, disconnectSub);
    session = null;
    return false;
  }
}

/**
 * Connect + discover UART char + run AT init for OBD2 or J1939-style adapters.
 * Holds the IO lock for the whole connect+init so live PID reads cannot interleave AT traffic.
 * Session is published only after AT init succeeds.
 *
 * Device switch: cancel prior radio only after snapshotting it; keep tracking until the new
 * connect+discovery+AT init succeed. On failure, cancel the half-open target and restore prior.
 */
export type ConnectElmResult = {
  ok: boolean;
  message: string;
  /** Device that owns the published session after this call (target or restored prior). */
  deviceId?: string;
  /** True when the prior live session was kept/restored after a failed switch. */
  restored?: boolean;
};

export async function connectAndInitElm(
  deviceId: string,
  protocol: ObdProtocol,
): Promise<ConnectElmResult> {
  const cap = getBleCapability();
  if (!cap.available) {
    return { ok: false, message: `BLE natif absent — ${cap.pathToLive}` };
  }
  if (deviceId.startsWith('mock-')) {
    return { ok: false, message: 'Appareil mock — pas de session BLE hardware.' };
  }

  const perm = await ensureAndroidBlePermissions();
  if (!perm.ok) {
    return { ok: false, message: perm.message ?? 'Permissions Bluetooth manquantes.' };
  }

  return withIoLock(async () => {
    const prior = session;
    let cancelledPrior = false;

    let manager: any = null;
    let monitorSub: { remove?: () => void } | null = null;
    let disconnectSub: { remove?: () => void } | null = null;
    const id = ++sessionSeq;

    const fail = async (message: string): Promise<ConnectElmResult> => {
      // Never leave an untracked live link after a failed connect/discovery/init.
      await releaseAttempt(manager, deviceId, monitorSub, disconnectSub);
      if (cancelledPrior && prior) {
        const restored = await restorePriorSession(prior);
        if (restored && session) {
          // UI must keep connectedId/liveBle on the restored prior — not clear them.
          return {
            ok: true,
            restored: true,
            deviceId: session.deviceId,
            message: `Switch échoué — session restaurée sur ${session.deviceId.slice(0, 8)}… (${message})`,
          };
        }
        session = null;
        return { ok: false, message };
      }
      if (prior && prior.deviceId === deviceId) {
        // Failed same-device reconnect — session is gone.
        session = null;
        return { ok: false, message };
      }
      // Prior never cancelled (e.g. manager init failed) — keep UI aligned with live session.
      if (session) {
        return {
          ok: true,
          restored: true,
          deviceId: session.deviceId,
          message: `Connexion échouée — session live conservée (${session.deviceId.slice(0, 8)}…). ${message}`,
        };
      }
      return { ok: false, message };
    };

    try {
      manager = await getSharedBleManager();

      if (prior && prior.deviceId !== deviceId) {
        // Free the radio to switch — keep session null only after we cancel prior.
        // Do not drop tracking permanently until the new link publishes (or restore fails).
        session = null;
        await teardownUnlocked(prior);
        cancelledPrior = true;
      } else if (prior && prior.deviceId === deviceId) {
        // Same-device reconnect: must clear half-open / stale GATT before connectToDevice.
        session = null;
        await teardownUnlocked(prior);
      } else {
        // First connect: only clear a half-open target on the shared manager.
        try {
          if (await manager.isDeviceConnected(deviceId)) {
            await manager.cancelDeviceConnection(deviceId);
          }
        } catch {
          /* ignore */
        }
      }

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
        return fail(
          'Connecté mais aucune caractéristique UART ELM (FFE0/FFE1) trouvée — adapter non supporté ou pairing requis.',
        );
      }

      // Pending session: not published until AT init succeeds (avoids live I/O racing half-ready UART).
      const pending: SessionState = {
        id,
        deviceId,
        protocol,
        manager,
        writeUuid,
        serviceUuid,
        notifyBuf: '',
        monitorSub: null,
        disconnectSub: null,
      };

      try {
        disconnectSub = manager.onDeviceDisconnected(deviceId, () => {
          clearSessionIfId(id);
        });
        pending.disconnectSub = disconnectSub;
      } catch {
        /* optional on some stacks */
      }

      try {
        monitorSub = manager.monitorCharacteristicForDevice(
          deviceId,
          serviceUuid,
          writeUuid,
          (err: Error | null, characteristic: { value?: string | null } | null) => {
            if (err) {
              clearSessionIfId(id);
              return;
            }
            if (!characteristic?.value) return;
            // Ignore if a newer session replaced us. Otherwise buffer on `pending`
            // (after publish, `session === pending` so live reads see the same buf).
            if (session && session.id !== id) return;
            pending.notifyBuf += base64ToAscii(characteristic.value);
          },
        );
        pending.monitorSub = monitorSub;
      } catch {
        /* some adapters are write+read only */
      }

      const init = protocol === 'J1939' || protocol === 'J1708' ? J1939_INIT_AT : ELM327_INIT_AT;
      const log: string[] = [];
      for (const at of init) {
        const resp = await writeAndAwait(at, atInitWaitMs(at), pending);
        log.push(`${at} → ${resp.slice(0, 80)}`);
        if (isElmInitFailure(resp, at)) {
          return fail(`Init AT échouée (${at} → ${resp.slice(0, 40)}) — valise non prête.`);
        }
      }

      // Publish only after successful AT init. IO lock ensures no concurrent connect
      // can replace us mid-init; fail path below tears down by this attempt's id only.
      session = pending;
      return {
        ok: true,
        deviceId,
        message: `Valise BLE connectée (${deviceId.slice(0, 8)}…) · init ${protocol} OK · ${log.length} AT`,
      };
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Échec connectAndInitElm');
    }
  });
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

    const rpmRaw = await writeAndAwait('010C', 1500, snapSession);
    if (!session || session.id !== snapSession.id) return null;
    rawLog.push(rpmRaw);
    sensors.rpm = parseRpm(rpmRaw);
    if (sensors.rpm === null) parseWarnings.push('RPM indisponible (timeout / réponse non ELM)');

    const ectRaw = await writeAndAwait('0105', 1200, snapSession);
    if (!session || session.id !== snapSession.id) return null;
    rawLog.push(ectRaw);
    sensors.ectC = parseEct(ectRaw);
    if (sensors.ectC === null) parseWarnings.push('Temp. eau indisponible');

    const mapRaw = await writeAndAwait('010B', 1200, snapSession);
    if (!session || session.id !== snapSession.id) return null;
    rawLog.push(mapRaw);
    sensors.mapKpa = parseMap(mapRaw);
    if (sensors.mapKpa === null) parseWarnings.push('MAP indisponible');

    const voltRaw = await writeAndAwait('0142', 1200, snapSession);
    if (!session || session.id !== snapSession.id) return null;
    rawLog.push(voltRaw);
    sensors.batV = parseVoltage(voltRaw);
    if (sensors.batV === null) parseWarnings.push('Tension module indisponible');

    const dtcRaw = await writeAndAwait('03', 2000, snapSession);
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

async function writeAndAwait(cmd: string, waitMs: number, target?: SessionState): Promise<string> {
  const cur = target ?? session;
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
    // Prefer the explicit target; fall back to global only if still same id.
    const live = target ?? (session?.id === sid ? session : null);
    if (!live || live.id !== sid) return 'DISCONNECTED';
    await live.manager.writeCharacteristicWithoutResponseForDevice(
      live.deviceId,
      live.serviceUuid,
      live.writeUuid,
      payload,
    );
  }
  await sleep(waitMs);
  const after = target ?? (session?.id === sid ? session : null);
  if (!after || after.id !== sid) return 'DISCONNECTED';
  if (after.notifyBuf.trim()) return after.notifyBuf;
  try {
    const ch = await after.manager.readCharacteristicForDevice(
      after.deviceId,
      after.serviceUuid,
      after.writeUuid,
    );
    if (target) {
      if (target.id !== sid) return 'DISCONNECTED';
    } else if (!session || session.id !== sid) {
      return 'DISCONNECTED';
    }
    if (ch?.value) return base64ToAscii(ch.value);
  } catch {
    /* ignore */
  }
  const final = target ?? (session?.id === sid ? session : null);
  if (!final || final.id !== sid) return 'DISCONNECTED';
  return final.notifyBuf || 'TIMEOUT';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** RN-safe base64 without undeclared `buffer` dependency. */
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(ascii: string): string {
  if (typeof btoa === 'function') return btoa(ascii);
  let out = '';
  let i = 0;
  while (i < ascii.length) {
    const a = ascii.charCodeAt(i++) & 0xff;
    const b = i < ascii.length ? ascii.charCodeAt(i++) & 0xff : NaN;
    const c = i < ascii.length ? ascii.charCodeAt(i++) & 0xff : NaN;
    const triple = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c);
    out += B64_ALPHABET[(triple >> 18) & 63];
    out += B64_ALPHABET[(triple >> 12) & 63];
    out += Number.isNaN(b) ? '=' : B64_ALPHABET[(triple >> 6) & 63];
    out += Number.isNaN(c) ? '=' : B64_ALPHABET[triple & 63];
  }
  return out;
}

function base64ToAscii(b64: string): string {
  if (typeof atob === 'function') return atob(b64);
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64_ALPHABET.indexOf(clean[i]!) << 18) |
      (B64_ALPHABET.indexOf(clean[i + 1]!) << 12) |
      ((clean[i + 2] === '=' ? 0 : B64_ALPHABET.indexOf(clean[i + 2]!)) << 6) |
      (clean[i + 3] === '=' ? 0 : B64_ALPHABET.indexOf(clean[i + 3]!));
    out += String.fromCharCode((n >> 16) & 0xff);
    if (clean[i + 2] !== '=') out += String.fromCharCode((n >> 8) & 0xff);
    if (clean[i + 3] !== '=') out += String.fromCharCode(n & 0xff);
  }
  return out;
}
