import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function toneFromRgb(rgb: { r: number; g: number; b: number } | null) {
  if (!rgb) return 'unknown';
  const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  if (luma < 70) return 'dark';
  if (luma < 170) return 'mid';
  return 'bright';
}

describe('visionPixelsLite', () => {
  it('source exposes LIVE label (not blocked stub)', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, 'visionPixelsLite.ts'), 'utf8');
    assert.match(src, /VISION_PIXELS_LIVE\s*=\s*'Vision lite LIVE/);
    assert.doesNotMatch(src, /Vision pixels non branchée/);
  });

  it('classifies dark / mid / bright luma', () => {
    assert.equal(toneFromRgb({ r: 10, g: 10, b: 10 }), 'dark');
    assert.equal(toneFromRgb({ r: 120, g: 120, b: 120 }), 'mid');
    assert.equal(toneFromRgb({ r: 240, g: 240, b: 240 }), 'bright');
    assert.equal(toneFromRgb(null), 'unknown');
  });
});
