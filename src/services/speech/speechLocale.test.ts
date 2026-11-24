import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DYSLEXIA_SPEECH_RATE,
  speechLanguageForLocale,
} from './speechLocale';

describe('speechLocale', () => {
  it('maps FR/EN/ES to BCP-47 tags', () => {
    assert.equal(speechLanguageForLocale('fr'), 'fr-FR');
    assert.equal(speechLanguageForLocale('en'), 'en-US');
    assert.equal(speechLanguageForLocale('es'), 'es-ES');
  });

  it('uses a dyslexia-friendly rate under 1.0', () => {
    assert.ok(DYSLEXIA_SPEECH_RATE < 1);
    assert.ok(DYSLEXIA_SPEECH_RATE >= 0.7);
  });
});
