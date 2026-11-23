import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseQuoteTextAmounts } from './parseQuoteText';

describe('parseQuoteTextAmounts', () => {
  it('empty text → no amounts + note', () => {
    const r = parseQuoteTextAmounts('  ');
    assert.deepEqual(r.amounts, []);
    assert.equal(r.partPrice, undefined);
    assert.equal(r.laborPrice, undefined);
    assert.match(r.note, /Aucun texte/);
  });

  it('keyword-anchored pièce / MO', () => {
    const r = parseQuoteTextAmounts('Pièce filtre 89,90 €\nMain d’œuvre 120 EUR');
    assert.equal(r.partPrice, 89.9);
    assert.equal(r.laborPrice, 120);
    assert.ok(r.amounts.length >= 2);
    assert.match(r.note, /OCR-lite/);
  });

  it('combined line assigns distinct amounts', () => {
    const r = parseQuoteTextAmounts('Pièce 189 · Main d’œuvre 120');
    assert.equal(r.partPrice, 189);
    assert.equal(r.laborPrice, 120);
  });

  it('European thousands style', () => {
    const r = parseQuoteTextAmounts('Pièce 1.234,50 €');
    assert.equal(r.partPrice, 1234.5);
  });

  it('unanchored fallback uses first two amounts', () => {
    const r = parseQuoteTextAmounts('Total garage 250 et 80');
    assert.equal(r.partPrice, 250);
    assert.equal(r.laborPrice, 80);
  });

  it('no numeric amounts', () => {
    const r = parseQuoteTextAmounts('Devis sans prix');
    assert.deepEqual(r.amounts, []);
    assert.match(r.note, /aucun montant/);
  });
});
