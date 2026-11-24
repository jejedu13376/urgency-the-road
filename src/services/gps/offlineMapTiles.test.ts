import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bboxAroundPoint,
  bboxFromCoords,
  densifyCoords,
  latToTileY,
  lonToTileX,
  roadsTileUrl,
  satelliteTileUrl,
  tilesForOfflinePack,
} from './offlineMapTilesMath';

describe('offlineMapTiles math', () => {
  it('lon/lat to tile at zoom 0 is 0,0', () => {
    assert.equal(lonToTileX(0, 0), 0);
    assert.equal(latToTileY(0, 0), 0);
  });

  it('Paris sits in expected tile band at z12', () => {
    const x = lonToTileX(2.3522, 12);
    const y = latToTileY(48.8566, 12);
    assert.ok(x > 2000 && x < 2200);
    assert.ok(y > 1400 && y < 1600);
  });

  it('bboxFromCoords pads route ends', () => {
    const box = bboxFromCoords([
      [45.5, -73.6],
      [45.6, -73.5],
    ]);
    assert.ok(box);
    assert.ok(box!.south < 45.5);
    assert.ok(box!.north > 45.6);
    assert.ok(box!.west < -73.6);
    assert.ok(box!.east > -73.5);
  });

  it('bboxAroundPoint returns area', () => {
    const box = bboxAroundPoint(45.5, -73.6, 0.1);
    assert.ok(box);
    assert.equal(Number(box!.north.toFixed(1)), 45.6);
  });

  it('tilesForOfflinePack returns capped unique tiles', () => {
    const tiles = tilesForOfflinePack(
      [
        [45.5, -73.6],
        [45.55, -73.55],
        [45.6, -73.5],
      ],
      10,
      12,
      500,
    );
    assert.ok(tiles.length > 10);
    assert.ok(tiles.length <= 500);
    const keys = new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`));
    assert.equal(keys.size, tiles.length);
  });

  it('densifyCoords inserts midpoints on long segments', () => {
    const dense = densifyCoords(
      [
        [45.0, -73.0],
        [45.2, -72.8],
      ],
      0.05,
    );
    assert.ok(dense.length > 2);
    assert.deepEqual(dense[0], [45.0, -73.0]);
    assert.deepEqual(dense[dense.length - 1], [45.2, -72.8]);
  });

  it('sparse GPS+dest pack covers area between endpoints (not only tips)', () => {
    const tiles = tilesForOfflinePack(
      [
        [45.5, -73.6],
        [45.7, -73.4],
      ],
      10,
      11,
      2000,
    );
    // Midpoint of the bbox should appear in the pack at z10.
    const midLat = 45.6;
    const midLon = -73.5;
    const mx = lonToTileX(midLon, 10);
    const my = latToTileY(midLat, 10);
    assert.ok(
      tiles.some((t) => t.z === 10 && t.x === mx && t.y === my),
      'expected midpoint tile from bbox fill',
    );
  });

  it('roadsTileUrl is carto or osm png', () => {
    const u = roadsTileUrl(12, 100, 200);
    assert.ok(u.includes('/12/100/200.png'));
    assert.ok(u.startsWith('https://'));
  });

  it('satelliteTileUrl uses Esri z/y/x order', () => {
    const u = satelliteTileUrl(12, 100, 200);
    assert.ok(u.includes('/tile/12/200/100'));
  });
});
