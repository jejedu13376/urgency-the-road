import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DRIVING_BREAK_THRESHOLD_SEC } from './drivingBreak';
import {
  FATIGUE_CRITICAL_SCORE,
  FATIGUE_STOP_TTS_EN,
  FATIGUE_STOP_TTS_ES,
  FATIGUE_STOP_TTS_FR,
  FATIGUE_STOP_TTS_SEQUENCE,
  computeFatigueScore,
  speakFatigueStopAlert,
} from './fatigueScore';

describe('fatigueScore', () => {
  it('stays ok early in the drive', () => {
    const f = computeFatigueScore({ drivingSec: 30 * 60, breaksTaken: 0 });
    assert.equal(f.level, 'ok');
    assert.equal(f.mustStop, false);
  });

  it('goes critical at 4h without breaks', () => {
    const f = computeFatigueScore({
      drivingSec: DRIVING_BREAK_THRESHOLD_SEC,
      breaksTaken: 0,
    });
    assert.ok(f.score >= FATIGUE_CRITICAL_SCORE);
    assert.equal(f.level, 'critical');
    assert.equal(f.mustStop, true);
  });

  it('breaks reduce fatigue score', () => {
    const tired = computeFatigueScore({
      drivingSec: DRIVING_BREAK_THRESHOLD_SEC,
      breaksTaken: 0,
    });
    const rested = computeFatigueScore({
      drivingSec: DRIVING_BREAK_THRESHOLD_SEC,
      breaksTaken: 2,
    });
    assert.ok(rested.score < tired.score);
  });

  it('stop TTS is FR → EN → ES', () => {
    assert.deepEqual(
      FATIGUE_STOP_TTS_SEQUENCE.map((l) => l.language),
      ['fr-FR', 'en-US', 'es-ES'],
    );
    assert.equal(
      FATIGUE_STOP_TTS_FR,
      'Arrêt obligatoire. Votre score de fatigue est critique. Arrêtez-vous maintenant et reposez-vous.',
    );
    assert.equal(
      FATIGUE_STOP_TTS_EN,
      'Mandatory stop. Your fatigue score is critical. Pull over now and rest.',
    );
    assert.equal(
      FATIGUE_STOP_TTS_ES,
      'Parada obligatoria. Su puntuación de fatiga es crítica. Deténgase ahora y descanse.',
    );
  });

  it('speakFatigueStopAlert speaks trio (injected)', async () => {
    const spoken: string[] = [];
    await speakFatigueStopAlert({
      repeat: 1,
      speak: async (language, text) => {
        spoken.push(`${language}:${text}`);
      },
    });
    assert.deepEqual(spoken, [
      `fr-FR:${FATIGUE_STOP_TTS_FR}`,
      `en-US:${FATIGUE_STOP_TTS_EN}`,
      `es-ES:${FATIGUE_STOP_TTS_ES}`,
    ]);
  });
});
