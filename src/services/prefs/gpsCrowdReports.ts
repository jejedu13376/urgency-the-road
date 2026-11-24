/**
 * Crowd map reports for Carte (police / hazard / accident).
 * Local AsyncStorage first; optional soft cloud via hazardsService.
 * Auto-expire ~45 min — typical crowd-nav freshness, not harassment tooling.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CrowdReportKind =
  | 'police'
  | 'accident'
  | 'ralentissement'
  | 'danger'
  | 'obstacle'
  | 'travaux'
  | 'autre';

export const CROWD_REPORT_KINDS: readonly CrowdReportKind[] = [
  'police',
  'accident',
  'ralentissement',
  'danger',
  'obstacle',
  'travaux',
  'autre',
] as const;

export function isCrowdReportKind(v: unknown): v is CrowdReportKind {
  return typeof v === 'string' && (CROWD_REPORT_KINDS as readonly string[]).includes(v);
}

export type CrowdReport = {
  id: string;
  kind: CrowdReportKind;
  lat: number;
  lon: number;
  note?: string;
  createdAt: string;
  expiresAt: string;
  source: 'local' | 'cloud';
};

export const GPS_CROWD_REPORTS_KEY = 'um.gps.crowd.reports.v1';
/** Default crowd-report TTL (45 minutes). */
export const CROWD_REPORT_TTL_MS = 45 * 60 * 1000;
const MAX_REPORTS = 80;
const MIN_INTERVAL_MS = 20_000;

let lastReportAt = 0;

function nowIso() {
  return new Date().toISOString();
}

function prune(list: CrowdReport[], now = Date.now()): CrowdReport[] {
  return list
    .filter((r) => {
      const exp = Date.parse(r.expiresAt);
      return Number.isFinite(exp) ? exp > now : false;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_REPORTS);
}

export async function loadCrowdReports(): Promise<CrowdReport[]> {
  try {
    const raw = await AsyncStorage.getItem(GPS_CROWD_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CrowdReport[];
    if (!Array.isArray(parsed)) return [];
    const cleaned = prune(parsed);
    if (cleaned.length !== parsed.length) {
      await AsyncStorage.setItem(GPS_CROWD_REPORTS_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export async function addCrowdReport(input: {
  kind: CrowdReportKind;
  lat: number;
  lon: number;
  note?: string;
}): Promise<{ ok: true; report: CrowdReport } | { ok: false; error: string }> {
  const t = Date.now();
  if (t - lastReportAt < MIN_INTERVAL_MS) {
    return { ok: false, error: 'Rate-limit — attendez quelques secondes entre signalements' };
  }
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lon)) {
    return { ok: false, error: 'Coordonnées invalides' };
  }
  lastReportAt = t;
  const report: CrowdReport = {
    id: `cr-${t}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    lat: input.lat,
    lon: input.lon,
    note: input.note?.trim() || undefined,
    createdAt: nowIso(),
    expiresAt: new Date(t + CROWD_REPORT_TTL_MS).toISOString(),
    source: 'local',
  };
  const prev = await loadCrowdReports();
  const next = prune([report, ...prev], t);
  await AsyncStorage.setItem(GPS_CROWD_REPORTS_KEY, JSON.stringify(next));
  return { ok: true, report };
}

/**
 * Merge cloud hazards for **display pins only**.
 * Do NOT feed cloud entries into Valhalla excludeLocations — Firestore rules do not
 * validate kind/coords/expiresAt yet (route-steering risk). Soft-fail cloud for routing.
 */
export function mergeCloudHazards(
  local: CrowdReport[],
  cloud: {
    id: string;
    kind: string;
    lat: number;
    lon: number;
    note?: string;
    createdAt: string;
    expiresAt?: string;
  }[],
): CrowdReport[] {
  const now = Date.now();
  const mapped: CrowdReport[] = [];
  for (const h of cloud) {
    if (!Number.isFinite(h.lat) || !Number.isFinite(h.lon)) continue;
    if (h.lat < -90 || h.lat > 90 || h.lon < -180 || h.lon > 180) continue;
    const kind = isCrowdReportKind(h.kind)
      ? h.kind
      : h.kind === 'radar'
        ? 'police'
        : h.kind === 'slowdown' || h.kind === 'traffic'
          ? 'ralentissement'
          : 'autre';
    const created = Date.parse(h.createdAt);
    const createdMs = Number.isFinite(created) ? created : now;
    // Never trust attacker-chosen far-future expiry — clamp to created+TTL.
    const claimed = h.expiresAt ? Date.parse(h.expiresAt) : NaN;
    const maxExp = createdMs + CROWD_REPORT_TTL_MS;
    const expiresMs = Number.isFinite(claimed) ? Math.min(claimed, maxExp) : maxExp;
    if (expiresMs <= now) continue;
    mapped.push({
      id: `cloud-${String(h.id).slice(0, 64)}`,
      kind,
      lat: h.lat,
      lon: h.lon,
      note: h.note ? String(h.note).replace(/[<>&"'`]/g, '').slice(0, 80) : undefined,
      createdAt: new Date(createdMs).toISOString(),
      expiresAt: new Date(expiresMs).toISOString(),
      source: 'cloud',
    });
  }
  const byId = new Map<string, CrowdReport>();
  for (const r of [...local, ...mapped]) byId.set(r.id, r);
  return prune([...byId.values()], now);
}
