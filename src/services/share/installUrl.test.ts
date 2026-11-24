import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickInstallUrl, UNSET_INSTALL_PLACEHOLDER } from './installUrlCore';

describe('pickInstallUrl', () => {
  it('prefers env URL', () => {
    const r = pickInstallUrl({
      envUrl: 'https://example.com/install',
      expoUrl: 'https://expo.example/',
    });
    assert.equal(r.configured, true);
    assert.equal(r.source, 'env');
    assert.equal(r.url, 'https://example.com/install');
  });

  it('uses expo http deep link when env unset', () => {
    const r = pickInstallUrl({
      envUrl: '',
      expoUrl: 'https://u.expo.dev/abc/',
    });
    assert.equal(r.source, 'expo');
    assert.equal(r.configured, true);
  });

  it('rejects non-http expo schemes as unset', () => {
    const r = pickInstallUrl({
      envUrl: '',
      expoUrl: 'exp://127.0.0.1:8081',
    });
    assert.equal(r.configured, false);
    assert.equal(r.source, 'unset');
    assert.equal(r.url, UNSET_INSTALL_PLACEHOLDER);
  });

  it('never invents a store listing', () => {
    const r = pickInstallUrl({});
    assert.equal(r.configured, false);
    assert.equal(r.url.includes('play.google'), false);
    assert.equal(r.url.includes('apps.apple'), false);
  });
});
