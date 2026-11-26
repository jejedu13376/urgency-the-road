import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ESRI_PLACES_LABELS_URL,
  ESRI_WORLD_STREET_URL,
  roadsTileUrl,
} from './buildGpsMapHtml';

describe('roadsTileUrl — global place labels', () => {
  it('uses Carto Voyager (with labels) when API key is set', () => {
    const cfg = roadsTileUrl('cb1_testkey_global_labels_abc');
    assert.equal(cfg.kind, 'carto');
    assert.match(cfg.url, /rastertiles\/voyager\//);
    assert.doesNotMatch(cfg.url, /nolabels/);
    assert.match(cfg.url, /[?&]key=cb1_testkey_global_labels_abc/);
    assert.equal(cfg.subdomains, 'abcd');
    assert.match(cfg.attribution, /CARTO/);
  });

  it('falls back to Esri World Street Map (global labels) without a key', () => {
    const cfg = roadsTileUrl('');
    assert.equal(cfg.kind, 'esri');
    assert.equal(cfg.url, ESRI_WORLD_STREET_URL);
    assert.doesNotMatch(cfg.url, /openstreetmap\.org/);
    assert.match(cfg.url, /World_Street_Map/);
  });

  it('sanitizes unsafe characters from the Carto key', () => {
    const cfg = roadsTileUrl('cb1_ok<script>evil');
    assert.equal(cfg.kind, 'carto');
    assert.doesNotMatch(cfg.url, /[<>]/);
    assert.match(cfg.url, /\?key=cb1_okscriptevil$/);
  });

  it('satellite place overlay URL is the global Boundaries & Places service', () => {
    assert.match(ESRI_PLACES_LABELS_URL, /World_Boundaries_and_Places/);
    assert.doesNotMatch(ESRI_PLACES_LABELS_URL, /USA_/);
  });
});
