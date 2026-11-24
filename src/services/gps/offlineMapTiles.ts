/**
 * Offline map tile pack — download Carto/OSM roads + Esri satellite tiles
 * for the current route corridor (or GPS area) into the app documents folder.
 * Leaflet loads them via file:// when the pack is active.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  OFFLINE_MAX_ZOOM,
  OFFLINE_MIN_ZOOM,
  bboxFromCoords,
  roadsTileUrl,
  satelliteTileUrl,
  tilesForOfflinePack,
  type OfflineBBox,
  type OfflineTileCoord,
} from './offlineMapTilesMath';

export {
  OFFLINE_MAX_TILES_PER_LAYER,
  OFFLINE_MAX_ZOOM,
  OFFLINE_MIN_ZOOM,
  bboxAroundPoint,
  bboxFromCoords,
  latToTileY,
  lonToTileX,
  roadsTileUrl,
  satelliteTileUrl,
  tilesForOfflinePack,
} from './offlineMapTilesMath';
export type { OfflineBBox, OfflineTileCoord } from './offlineMapTilesMath';

export const OFFLINE_MAP_MANIFEST_KEY = 'um.gps.offline.map.v1';
export const OFFLINE_MAP_DIR = 'offline-map';

const CONCURRENCY = 6;

export type OfflineMapLayer = 'roads' | 'satellite';

export type OfflineMapManifest = {
  version: 1;
  updatedAt: string;
  bbox: OfflineBBox;
  minZoom: number;
  maxZoom: number;
  layers: OfflineMapLayer[];
  tileCount: number;
  bytesApprox: number;
  rootUri: string;
  label?: string;
};

export type OfflineDownloadProgress = {
  done: number;
  total: number;
  layer: OfflineMapLayer;
  phase: 'prepare' | 'download' | 'done' | 'error';
  message?: string;
};

export type OfflineDownloadResult =
  | { ok: true; manifest: OfflineMapManifest }
  | { ok: false; error: string };

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function layerTileUrl(layer: OfflineMapLayer, t: OfflineTileCoord): string {
  return layer === 'satellite'
    ? satelliteTileUrl(t.z, t.x, t.y)
    : roadsTileUrl(t.z, t.x, t.y);
}

export function offlineMapRootUri(): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  return `${base}${OFFLINE_MAP_DIR}/`;
}

export async function loadOfflineMapManifest(): Promise<OfflineMapManifest | null> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_MAP_MANIFEST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const m = parsed as Partial<OfflineMapManifest>;
    if (m.version !== 1 || typeof m.rootUri !== 'string') return null;
    if (!m.bbox || typeof m.tileCount !== 'number') return null;
    return m as OfflineMapManifest;
  } catch {
    return null;
  }
}

async function saveManifest(manifest: OfflineMapManifest): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_MAP_MANIFEST_KEY, JSON.stringify(manifest));
}

export async function clearOfflineMapPack(): Promise<void> {
  const root = offlineMapRootUri();
  if (root) {
    try {
      await FileSystem.deleteAsync(root, { idempotent: true });
    } catch {
      /* ignore */
    }
  }
  await AsyncStorage.removeItem(OFFLINE_MAP_MANIFEST_KEY);
}

async function ensureDir(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

async function downloadOne(
  url: string,
  dest: string,
): Promise<{ ok: boolean; bytes: number }> {
  try {
    const parent = dest.replace(/\/[^/]+$/, '/');
    await ensureDir(parent);
    const existing = await FileSystem.getInfoAsync(dest);
    if (existing.exists && !existing.isDirectory) {
      return { ok: true, bytes: existing.size ?? 0 };
    }
    const result = await FileSystem.downloadAsync(url, dest);
    if (result.status !== 200) {
      try {
        await FileSystem.deleteAsync(dest, { idempotent: true });
      } catch {
        /* ignore */
      }
      return { ok: false, bytes: 0 };
    }
    const info = await FileSystem.getInfoAsync(dest);
    return { ok: true, bytes: info.exists && !info.isDirectory ? (info.size ?? 0) : 0 };
  } catch {
    return { ok: false, bytes: 0 };
  }
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i]!, i);
    }
  });
  await Promise.all(runners);
  return out;
}

export type DownloadOfflinePackInput = {
  /** Route polyline [lat, lon]; if empty, pass areaCoords from GPS + dest. */
  coords: [number, number][];
  label?: string;
  layers?: OfflineMapLayer[];
  minZoom?: number;
  maxZoom?: number;
  onProgress?: (p: OfflineDownloadProgress) => void;
  signal?: { aborted: boolean };
};

/**
 * Download roads (+ satellite) tiles for the route/area into documents.
 * No-op friendly on web when documentDirectory is unavailable.
 */
export async function downloadOfflineMapPack(
  input: DownloadOfflinePackInput,
): Promise<OfflineDownloadResult> {
  const root = offlineMapRootUri();
  if (!root || Platform.OS === 'web') {
    return {
      ok: false,
      error:
        Platform.OS === 'web'
          ? 'Téléchargement hors ligne disponible sur l’app mobile (iOS / Android)'
          : 'Stockage local indisponible',
    };
  }

  const coords = input.coords.filter(
    (c) =>
      Array.isArray(c) &&
      isFiniteCoord(c[0]) &&
      isFiniteCoord(c[1]) &&
      c[0] >= -90 &&
      c[0] <= 90 &&
      c[1] >= -180 &&
      c[1] <= 180,
  );
  if (coords.length < 1) {
    return { ok: false, error: 'Zone GPS ou itinéraire requis pour la carte hors ligne' };
  }

  const bbox = bboxFromCoords(coords);
  if (!bbox) return { ok: false, error: 'Zone invalide' };

  const minZoom = input.minZoom ?? OFFLINE_MIN_ZOOM;
  const maxZoom = input.maxZoom ?? OFFLINE_MAX_ZOOM;
  const layers: OfflineMapLayer[] = input.layers?.length
    ? input.layers
    : ['roads', 'satellite'];
  const tiles = tilesForOfflinePack(coords, minZoom, maxZoom);
  if (!tiles.length) {
    return { ok: false, error: 'Aucun tuile à télécharger pour cette zone' };
  }

  const jobs: { layer: OfflineMapLayer; tile: OfflineTileCoord; url: string; dest: string }[] =
    [];
  for (const layer of layers) {
    for (const tile of tiles) {
      jobs.push({
        layer,
        tile,
        url: layerTileUrl(layer, tile),
        dest: `${root}${layer}/${tile.z}/${tile.x}/${tile.y}.png`,
      });
    }
  }

  input.onProgress?.({
    done: 0,
    total: jobs.length,
    layer: layers[0]!,
    phase: 'prepare',
    message: `Préparation · ${jobs.length} tuiles`,
  });

  try {
    await ensureDir(root);
  } catch {
    return { ok: false, error: 'Impossible de créer le dossier hors ligne' };
  }

  let done = 0;
  let bytes = 0;
  let failures = 0;

  await mapPool(jobs, CONCURRENCY, async (job) => {
    if (input.signal?.aborted) return;
    const r = await downloadOne(job.url, job.dest);
    done += 1;
    if (r.ok) bytes += r.bytes;
    else failures += 1;
    input.onProgress?.({
      done,
      total: jobs.length,
      layer: job.layer,
      phase: 'download',
      message: `${done}/${jobs.length} tuiles`,
    });
  });

  if (input.signal?.aborted) {
    return { ok: false, error: 'Téléchargement annulé' };
  }

  const saved = jobs.length - failures;
  if (saved < Math.max(1, Math.floor(jobs.length * 0.5))) {
    return {
      ok: false,
      error: `Échec réseau — seulement ${saved}/${jobs.length} tuiles`,
    };
  }

  const manifest: OfflineMapManifest = {
    version: 1,
    updatedAt: new Date().toISOString(),
    bbox,
    minZoom,
    maxZoom,
    layers,
    tileCount: saved,
    bytesApprox: bytes,
    rootUri: root,
    label: input.label,
  };
  await saveManifest(manifest);
  input.onProgress?.({
    done: jobs.length,
    total: jobs.length,
    layer: layers[0]!,
    phase: 'done',
    message: `Carte hors ligne prête · ${saved} tuiles`,
  });
  return { ok: true, manifest };
}

/** Payload injected into Leaflet to prefer local file tiles. */
export function offlineTilesInjectPayload(manifest: OfflineMapManifest): {
  rootUri: string;
  minZoom: number;
  maxZoom: number;
  layers: OfflineMapLayer[];
  bbox: OfflineBBox;
} {
  return {
    rootUri: manifest.rootUri,
    minZoom: manifest.minZoom,
    maxZoom: manifest.maxZoom,
    layers: manifest.layers,
    bbox: manifest.bbox,
  };
}

export function formatOfflineBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
