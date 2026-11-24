import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFilAiPrompt,
  formatFilAiReply,
  FIL_AI_SUBJECTS,
  type FilAiSubject,
} from './filAiPrompts';
import type { VehicleProfile } from '../../types/vehicle';

const vehicle: VehicleProfile = {
  id: 'v1',
  label: 'Test',
  continent: 'EU',
  country: 'FR',
  make: 'Renault',
  model: 'Master',
  year: 2019,
  powertrain: 'diesel',
  vehicleClass: 'poids_lourd',
  fluids: { engineOilL: 8, coolantL: 10, washerL: 3 },
  commonFailures: [],
  odometerKm: 180000,
  unitSystem: 'metric',
  currency: 'EUR',
  vin: 'VF1MASTERTEST00001',
};

describe('filAiAgent prompts', () => {
  it('lists all five subjects', () => {
    assert.deepEqual(FIL_AI_SUBJECTS, [
      'car',
      'truck',
      'parts',
      'diagnostic',
      'truckers',
    ]);
  });

  it('embeds subject + vehicle into context', () => {
    const { prompt, context } = buildFilAiPrompt({
      message: 'bruit frein à froid',
      subject: 'diagnostic',
      vehicle,
      locale: 'fr',
    });
    assert.match(prompt, /diagnostic/);
    assert.match(prompt, /bruit frein/);
    assert.match(context, /sujet=diagnostic/);
    assert.match(context, /Renault Master 2019/);
    assert.match(context, /VIN=VF1MASTERTEST00001/);
    assert.match(context, /DIAGNOSTIC/i);
  });

  it('keeps truckers subject prompt distinct from parts', () => {
    const truckers = buildFilAiPrompt({
      message: 'pause HOS',
      subject: 'truckers',
      locale: 'fr',
    });
    const parts = buildFilAiPrompt({
      message: 'plaquette référence',
      subject: 'parts',
      locale: 'fr',
    });
    assert.match(truckers.context, /ROUTIERS|HOS/i);
    assert.match(parts.context, /PIÈCES|pièce/i);
    assert.notEqual(truckers.context, parts.context);
  });

  it('uses Spanish prompts when locale is es', () => {
    const { context, prompt } = buildFilAiPrompt({
      message: 'ruido de frenos',
      subject: 'car',
      locale: 'es',
    });
    assert.match(prompt, /Agente Fil/);
    assert.match(context, /COCHE|español/i);
    assert.doesNotMatch(context, /Tu es l’agent/);
  });

  it('folds recent history into context', () => {
    const { context } = buildFilAiPrompt({
      message: 'et les freins ?',
      subject: 'car',
      history: [
        { role: 'user', text: 'voyant ABS' },
        { role: 'assistant', text: 'Vérifiez le capteur ABS.' },
      ],
      locale: 'fr',
    });
    assert.match(context, /voyant ABS/);
    assert.match(context, /capteur ABS/);
  });

  for (const subject of FIL_AI_SUBJECTS as FilAiSubject[]) {
    it(`builds non-empty prompt for subject ${subject}`, () => {
      const { prompt, context } = buildFilAiPrompt({
        message: 'test',
        subject,
        locale: 'en',
      });
      assert.ok(prompt.length > 8);
      assert.match(context, new RegExp(`sujet=${subject}`));
    });
  }
});

describe('formatFilAiReply', () => {
  it('returns short dyslexia-friendly reply with parts', () => {
    const reply = formatFilAiReply(
      {
        ok: true,
        consensus: 'Freinage usé. Vérifiez les plaquettes.',
        likelyParts: ['Plaquettes de frein', 'Disques'],
        severity: 'warn',
      },
      'parts',
      'fr',
    );
    assert.match(reply, /Sujet/);
    assert.match(reply, /Plaquettes/);
    assert.match(reply, /attention|Gravité/i);
  });

  it('prefers engine summaries over French consensus tally', () => {
    const reply = formatFilAiReply(
      {
        ok: true,
        consensus: 'Consensus sur « bruit » — 6 moteur(s), dont 2 live.',
        likelyParts: ['Plaquettes'],
        severity: 'warn',
        engineSummaries: [
          'Brake pads look worn; check discs next.',
          'Also inspect hub bearing if noise continues.',
        ],
      },
      'parts',
      'en',
    );
    assert.match(reply, /Brake pads look worn/);
    assert.doesNotMatch(reply, /Consensus sur/);
  });

  it('handles empty failure', () => {
    const reply = formatFilAiReply(
      {
        ok: false,
        consensus: '',
        likelyParts: [],
        severity: 'info',
      },
      'car',
      'en',
    );
    assert.match(reply, /could not answer/i);
  });

  it('formats Spanish empty failure', () => {
    const reply = formatFilAiReply(
      {
        ok: false,
        consensus: '',
        likelyParts: [],
        severity: 'info',
      },
      'car',
      'es',
    );
    assert.match(reply, /No pude responder/i);
  });
});
