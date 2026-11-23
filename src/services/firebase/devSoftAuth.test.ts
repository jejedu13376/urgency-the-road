import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPermissionDenied } from './devSoftAuth';
import { failResult, flaggedDemoResult, mockResult } from './result';

describe('isPermissionDenied', () => {
  it('detects firestore permission-denied code', () => {
    assert.equal(isPermissionDenied({ code: 'permission-denied' }), true);
    assert.equal(isPermissionDenied({ code: 'storage/unauthorized' }), true);
    assert.equal(isPermissionDenied({ code: 'functions/permission-denied' }), true);
  });

  it('detects classic message', () => {
    assert.equal(
      isPermissionDenied(new Error('Missing or insufficient permissions.')),
      true,
    );
  });

  it('rejects unrelated errors', () => {
    assert.equal(isPermissionDenied(null), false);
    assert.equal(isPermissionDenied({ code: 'unavailable' }), false);
    assert.equal(isPermissionDenied(new Error('network')), false);
  });
});

describe('result helpers soft-fail contract', () => {
  it('mockResult is ok:true (local unsigned only)', () => {
    const r = mockResult([], 'MOCK');
    assert.equal(r.ok, true);
    assert.equal(r.source, 'mock');
  });

  it('failResult is ok:false', () => {
    const r = failResult([], 'SOFT — permission');
    assert.equal(r.ok, false);
    assert.equal(r.source, 'firebase');
    assert.match(r.stubLabel ?? '', /SOFT/);
  });

  it('flaggedDemoResult is ok:false mock (never live PHI)', () => {
    const r = flaggedDemoResult({ phi: true }, 'DEMO medical');
    assert.equal(r.ok, false);
    assert.equal(r.source, 'mock');
  });
});
