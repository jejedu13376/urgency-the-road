import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BREAK_TTS_EN,
  BREAK_TTS_ES,
  BREAK_TTS_FR,
  BREAK_TTS_SEQUENCE,
  DRIVING_BREAK_THRESHOLD_SEC,
  accumulateDrivingTime,
  createInitialDrivingBreakState,
  isDrivingBreakDue,
  resetDrivingBreakAfterBreak,
  shouldCountAsDriving,
  speakDrivingBreakAlert,
} from './drivingBreak';

describe('drivingBreak', () => {
  it('TTS sequence is FR → EN → ES with exact lines', () => {
    assert.equal(BREAK_TTS_SEQUENCE.length, 3);
    assert.deepEqual(
      BREAK_TTS_SEQUENCE.map((l) => l.language),
      ['fr-FR', 'en-US', 'es-ES'],
    );
    assert.equal(
      BREAK_TTS_FR,
      'Il est temps de faire une pause. Allez boire un café et dégourdir les jambes.',
    );
    assert.equal(
      BREAK_TTS_EN,
      'Time for a break. Go grab a coffee and stretch your legs.',
    );
    assert.equal(
      BREAK_TTS_ES,
      'Es hora de hacer una pausa. Ve a tomar un café y estira las piernas.',
    );
  });

  it('does not count stationary / app-open-only time', () => {
    const base = createInitialDrivingBreakState();
    const still = accumulateDrivingTime(base, { deltaSec: 60, speedMps: 0 });
    assert.equal(still.state.drivingSec, 0);
    assert.equal(still.crossedThreshold, false);

    const nullSpeed = accumulateDrivingTime(base, { deltaSec: 60, speedMps: null });
    assert.equal(nullSpeed.state.drivingSec, 0);

    assert.equal(shouldCountAsDriving(1.5), false);
    assert.equal(shouldCountAsDriving(2), true);
  });

  it('accumulates motion time and crosses exactly at 4h', () => {
    let state = createInitialDrivingBreakState();
    const near = accumulateDrivingTime(state, {
      deltaSec: DRIVING_BREAK_THRESHOLD_SEC - 10,
      speedMps: 15,
    });
    assert.equal(near.crossedThreshold, false);
    assert.equal(isDrivingBreakDue(near.state), false);

    const cross = accumulateDrivingTime(near.state, { deltaSec: 10, speedMps: 12 });
    assert.equal(cross.crossedThreshold, true);
    assert.equal(isDrivingBreakDue(cross.state), true);
    assert.equal(cross.state.drivingSec, DRIVING_BREAK_THRESHOLD_SEC);

    state = resetDrivingBreakAfterBreak();
    assert.equal(state.drivingSec, 0);
    assert.equal(state.alertSpoken, false);
  });

  it('speakDrivingBreakAlert speaks FR → EN → ES (injected speaker)', async () => {
    const spoken: string[] = [];
    await speakDrivingBreakAlert({
      repeat: 1,
      speak: async (language, text) => {
        spoken.push(`${language}:${text}`);
      },
    });
    assert.deepEqual(spoken, [
      `fr-FR:${BREAK_TTS_FR}`,
      `en-US:${BREAK_TTS_EN}`,
      `es-ES:${BREAK_TTS_ES}`,
    ]);
  });
});
