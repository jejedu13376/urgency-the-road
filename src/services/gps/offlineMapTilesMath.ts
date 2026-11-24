/**
 * Pure tile math for offline map packs (no RN / FileSystem imports).
 */

export const OFFLINE_MIN_ZOOM = 10;
export const OFFLINE_MAX_ZOOM = 15;
export const OFFLINE_MAX_TILES_PER_LAYER = 1800;
const ROUTE_SAMPLE_MAX = 120;
const TILE_PAD = 1;

export type OfflineBBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type OfflineTileCoord = { z: number; x: number; y: number };

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Web mercator tile X for longitude. */
export function lonToTileX(lon: number, z: number): number {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  return Math.min(n - 1, Math.max(0, x));
}

/** Web mercator tile Y for latitude. */
export function latToTileY(lat: number, z: number): number {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  );
  return Math.min(n - 1, Math.max(0, y));
}

export function bboxFromCoords(coords: [number, number][]): OfflineBBox | null {
  if (!coords.length) return null;
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  for (const [lat, lon] of coords) {
    if (!isFiniteCoord(lat) || !isFiniteCoord(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lon);
    east = Math.max(east, lon);
  }
  if (south > north || west > east) return null;
  const pad = 0.02;
  return {
    south: Math.max(-85, south - pad),
    north: Math.min(85, north + pad),
    west: Math.max(-180, west - pad),
    east: Math.min(180, east + pad),
  };
}

/** Area around a single point (current map / GPS). */
export function bboxAroundPoint(lat: number, lon: number, padDeg = 0.08): OfflineBBox | null {
  if (!isFiniteCoord(lat) || !isFiniteCoord(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    south: Math.max(-85, lat - padDeg),
    north: Math.min(85, lat + padDeg),
    west: Math.max(-180, lon - padDeg),
    east: Math.min(180, lon + padDeg),
  };
}

function downsampleRoute(
  coords: [number, number][],
  max = ROUTE_SAMPLE_MAX,
): [number, number][] {
  if (coords.length <= max) return coords.slice();
  if (max < 2) return coords.slice(0, max);
  const out: [number, number][] = [];
  const last = coords.length - 1;
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i / (max - 1)) * last);
    out.push(coords[idx]!);
  }
  return out;
}

/**
 * Tile set covering a route corridor (sampled points + pad) across zoom levels.
 */
export function tilesForOfflinePack(
  coords: [number, number][],
  minZoom = OFFLINE_MIN_ZOOM,
  maxZoom = OFFLINE_MAX_ZOOM,
  maxTiles = OFFLINE_MAX_TILES_PER_LAYER,
): OfflineTileCoord[] {
  const bbox = bboxFromCoords(coords);
  if (!bbox) return [];
  const key = (t: OfflineTileCoord) => `${t.z}/${t.x}/${t.y}`;
  const seen = new Set<string>();
  const out: OfflineTileCoord[] = [];

  const add = (z: number, x: number, y: number) => {
    const n = 2 ** z;
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const t = { z, x, y };
    const k = key(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  const samples = downsampleRoute(coords);
  for (let z = minZoom; z <= maxZoom; z++) {
    if (samples.length >= 2) {
      for (const [lat, lon] of samples) {
        const cx = lonToTileX(lon, z);
        const cy = latToTileY(lat, z);
        for (let dx = -TILE_PAD; dx <= TILE_PAD; dx++) {
          for (let dy = -TILE_PAD; dy <= TILE_PAD; dy++) {
            add(z, cx + dx, cy + dy);
          }
        }
      }
    } else {
      const x0 = lonToTileX(bbox.west, z);
      const x1 = lonToTileX(bbox.east, z);
      const y0 = latToTileY(bbox.north, z);
      const y1 = latToTileY(bbox.south, z);
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
          add(z, x, y);
        }
      }
    }
    if (out.length >= maxTiles) break;
  }

  if (out.length > maxTiles) return out.slice(0, maxTiles);
  return out;
}

/** Carto Voyager when keyed; else OSM — matches buildGpsMapHtml roads layer. */
export function roadsTileUrl(z: number, x: number, y: number): string {
  const raw = (process.env.EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY ?? '').trim();
  const key = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  if (key) {
    return `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png?key=${key}`;
  }
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/** Esri World Imagery — same URL pattern as Leaflet sat layer ({z}/{y}/{x}). */
export function satelliteTileUrl(z: number, x: number, y: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}
