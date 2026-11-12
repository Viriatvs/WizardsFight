import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES, randomMode, buildChoices, maskSpell, revealRandomLetter, CHOICE_COUNT, scramblePuzzle, isSolved,
  PUZZLE_IMAGES, randomPuzzleImage,
  hangmanStart, hangmanNextLetter, matchWords, lettersFound, spellWordCount, fillWords,
} from './modes';
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

test('hangman starts with first letters, then reveals last letters left to right, then random ones', () => {
  const latin = 'Ignis Aeternus Devora';
  let masked = hangmanStart(latin);
  assert.equal(masked, 'I____ A_______ D_____');
  masked = hangmanNextLetter(latin, masked);
  assert.equal(masked, 'I___s A_______ D_____');
  masked = hangmanNextLetter(latin, masked);
  masked = hangmanNextLetter(latin, masked);
  assert.equal(masked, 'I___s A______s D____a');
  const before = masked;
  masked = hangmanNextLetter(latin, masked); // now random: exactly one more letter
  assert.equal([...masked].filter((c, i) => c !== before[i]).length, 1);
  while (masked.includes('_')) masked = hangmanNextLetter(latin, masked);
  assert.equal(masked, latin);
  assert.equal(hangmanStart('A Lux'), 'A L__'); // one-letter words are fully shown
});

test('memorize: words count in any position, ignoring case, and add up letters', () => {
  const spell = 'abutres vao cair logo';
  // What the phone shows: the found words (as the server sends them) on top of the all-underscore mask.
  const shown = (found: number[]) => fillWords(maskSpell(spell), Object.fromEntries(found.map((i) => [i, spell.split(' ')[i]])));
  let found = matchWords(spell, 'abutres vio fell');
  assert.deepEqual(found, [0]);
  assert.equal(shown(found), 'abutres ___ ____ ____');
  found = matchWords(spell, 'LOGO', found);
  assert.equal(shown(found), 'abutres ___ ____ logo');
  assert.equal(lettersFound(spell, found), 11);
  found = matchWords(spell, 'cair vao', found);
  assert.equal(found.length, spellWordCount(spell));
  assert.equal(shown(found), spell);
  assert.deepEqual(matchWords('Vita Tua Mea Vita', 'vita'), [0, 3]); // repeated words both found
});

test('fillWords puts a player\'s found words on top of the shared hangman letters', () => {
  assert.equal(fillWords('I___s A______s D____a', { 2: 'Devora' }), 'I___s A______s Devora');
  assert.equal(fillWords('_____ ___ ____ ____', { 0: 'abutres', 3: 'logo' }), 'abutres ___ ____ logo');
  assert.equal(fillWords('I___s A______s'), 'I___s A______s');
});

test('randomPuzzleImage never repeats the previous picture and can reach every other one', () => {
  for (const prev of PUZZLE_IMAGES) {
    const seen = new Set<string>();
    const others = PUZZLE_IMAGES.length - 1;
    for (let i = 0; i < others; i++) {
      const img = randomPuzzleImage(prev, () => i / others);
      assert.notEqual(img, prev);
      seen.add(img);
    }
    assert.equal(seen.size, others);
  }
  assert.ok(PUZZLE_IMAGES.includes(randomPuzzleImage(null) as (typeof PUZZLE_IMAGES)[number]));
});
