import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DROWSINESS_CLOSED_EYES_MS,
  createDrowsinessMonitorState,
  ingestDrowsinessSample,
  speakDrowsinessAlert,
} from './drowsinessMonitor';

describe('drowsinessMonitor', () => {
  it('threshold is exactly 3000 ms closed eyes', () => {
    assert.equal(DROWSINESS_CLOSED_EYES_MS, 3000);
  });

  it('does not alert before 3s continuous closed eyes', () => {
    let state = createDrowsinessMonitorState();
    let crossed = false;
    const t0 = 1_000_000;
    ({ state, crossedThreshold: crossed } = ingestDrowsinessSample(state, {
      eyesClosed: true,
      atMs: t0,
    }));
    assert.equal(crossed, false);

    ({ state, crossedThreshold: crossed } = ingestDrowsinessSample(state, {
      eyesClosed: true,
      atMs: t0 + 2999,
    }));
    assert.equal(crossed, false);
    assert.ok(state.closedStreakMs < DROWSINESS_CLOSED_EYES_MS);
  });

  it('alerts when closed-eyes streak reaches exactly 3s', () => {
    let state = createDrowsinessMonitorState();
    let crossed = false;
    const t0 = 2_000_000;
    // 100 ms samples (same cadence as DrowsinessMonitorCard) for 3.0 s
    for (let i = 0; i <= 30; i += 1) {
      ({ state, crossedThreshold: crossed } = ingestDrowsinessSample(state, {
        eyesClosed: true,
        atMs: t0 + i * 100,
      }));
      if (i < 30) assert.equal(crossed, false);
    }
    assert.equal(crossed, true);
    assert.ok(state.closedStreakMs >= DROWSINESS_CLOSED_EYES_MS);
  });

  it('resets streak when eyes open', () => {
    let state = createDrowsinessMonitorState();
    const t0 = 3_000_000;
    ({ state } = ingestDrowsinessSample(state, { eyesClosed: true, atMs: t0 }));
    ({ state } = ingestDrowsinessSample(state, { eyesClosed: true, atMs: t0 + 2000 }));
    const open = ingestDrowsinessSample(state, { eyesClosed: false, atMs: t0 + 2100 });
    assert.equal(open.state.closedStreakMs, 0);
    assert.equal(open.crossedThreshold, false);
  });

  it('speakDrowsinessAlert is audible TTS (injected speaker)', async () => {
    const spoken: string[] = [];
    await speakDrowsinessAlert({
      cycles: 1,
      speak: async (language, text) => {
        spoken.push(`${language}:${text.slice(0, 24)}`);
      },
    });
    assert.equal(spoken.length, 2);
    assert.ok(spoken[0].startsWith('fr-FR:'));
    assert.ok(spoken[1].startsWith('en-US:'));
  });
});
