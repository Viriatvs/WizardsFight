import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, randomMode, buildChoices, maskSpell, revealRandomLetter, CHOICE_COUNT, scramblePuzzle, isSolved } from './modes';
import type { SpellData } from '@/types/game';

const spell = (latin: string, english: string, description = `${english}.`): SpellData => ({ latin, english, description, category: 'Test' });
const POOL = [spell('Lux', 'Light'), spell('Nox', 'Night'), spell('Ignis', 'Fire'), spell('Aqua', 'Water'), spell('Terra', 'Earth'), spell('Dup', 'Light')];

test('randomMode never repeats the previous mode and can reach every other mode', () => {
  for (const prev of MODES) {
    const seen = new Set<string>();
    for (let i = 0; i < MODES.length - 1; i++) {
      const m = randomMode(prev, () => i / (MODES.length - 1));
      assert.notEqual(m, prev);
      seen.add(m);
    }
    assert.equal(seen.size, MODES.length - 1);
  }
});

test('buildChoices: 4 unique options, exactly one correct, none duplicating the answer', () => {
  for (let i = 0; i < 50; i++) {
    const options = buildChoices(POOL[0], POOL, 'english');
    assert.equal(options.length, CHOICE_COUNT);
    assert.equal(new Set(options).size, CHOICE_COUNT);
    assert.equal(options.filter((o) => o === 'Light').length, 1); // 'Dup' shares the answer and must not add a second one
  }
  assert.ok(buildChoices(POOL[1], POOL, 'description').includes('Night.'));
});

test('maskSpell hides letters and keeps spaces', () => {
  assert.equal(maskSpell('Lux in Tenebris'), '___ __ ________');
});

test('revealRandomLetter uncovers one hidden letter at a time until the spell is complete', () => {
  const latin = 'Lux in Tenebris';
  let masked = maskSpell(latin);
  const letters = latin.replace(/ /g, '').length;
  for (let step = 1; step <= letters; step++) {
    const next = revealRandomLetter(latin, masked);
    assert.equal([...next].filter((c, i) => c !== masked[i]).length, 1);
    masked = next;
  }
  assert.equal(masked, latin);
  assert.equal(revealRandomLetter(latin, masked), latin);
});

test('scramblePuzzle returns all 12 tiles once and never an already solved picture', () => {
  for (let i = 0; i < 200; i++) {
    const order = scramblePuzzle();
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: 12 }, (_, t) => t));
    assert.equal(isSolved(order), false);
  }
  // A "random" source that keeps the identity order must still not yield a solved puzzle on the first try.
  let calls = 0;
  const identityFirst = () => (calls++ < 11 ? 0.999999 : Math.random());
  assert.equal(isSolved(scramblePuzzle(identityFirst)), false);
});

test('isSolved accepts only the complete, in-order picture', () => {
  const solved = Array.from({ length: 12 }, (_, i) => i);
  assert.equal(isSolved(solved), true);
  assert.equal(isSolved([1, 0, ...solved.slice(2)]), false);
  assert.equal(isSolved(solved.slice(0, 11)), false);
});
