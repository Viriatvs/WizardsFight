import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES, randomMode, buildChoices, maskSpell, CHOICE_COUNT, scramblePuzzle, isSolved,
  PUZZLE_IMAGES, randomPuzzleImage,
  matchWords, lettersFound, spellWordCount, fillWords, rpsThrowWinner, isRpsHand, randomRpsHand,
  mathQuestion, MATH_FACTOR,
  potionSequence, potionLength, potionDecided, POTION_INGREDIENTS, POTION_MAX_LEVEL,
  runeLayout, randomRune, runeRoundWinner, RUNE_COUNT,
} from './modes';
import type { BattleMode, SpellData } from '@/types/game';

const spell = (latin: string, english: string, description = `${english}.`): SpellData => ({ latin, english, description, category: 'Test' });
const POOL = [spell('Lux', 'Light'), spell('Nox', 'Night'), spell('Ignis', 'Fire'), spell('Aqua', 'Water'), spell('Terra', 'Earth'), spell('Dup', 'Light')];

test('randomMode plays every mode once per battle before repeating any', () => {
  for (let run = 0; run < 50; run++) {
    let used: BattleMode[] = [];
    let previous: BattleMode | null = MODES[run % MODES.length]; // last mode of the previous battle
    const cycle = (): BattleMode[] => MODES.map(() => {
      const m = randomMode(used, previous);
      assert.notEqual(m, previous);
      if (used.length >= MODES.length) used = [];
      used.push(m);
      previous = m;
      return m;
    });
    assert.equal(new Set(cycle()).size, MODES.length);
    assert.equal(new Set(cycle()).size, MODES.length); // and again for the next cycle
  }
});

test('randomMode never repeats the previous mode and can reach every other mode', () => {
  for (const prev of MODES) {
    const seen = new Set<string>();
    for (let i = 0; i < MODES.length - 1; i++) {
      const m = randomMode([], prev, () => i / (MODES.length - 1));
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

test('fillWords puts a player\'s found words on top of the mask', () => {
  assert.equal(fillWords('_____ ___ ____ ____', { 0: 'abutres', 3: 'logo' }), 'abutres ___ ____ logo');
  assert.equal(fillWords('_____ ___'), '_____ ___');
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

test('rpsThrowWinner: rock beats scissors beats paper beats rock; no pick loses; same hand ties', () => {
  assert.equal(rpsThrowWinner('rock', 'scissors'), 'a');
  assert.equal(rpsThrowWinner('scissors', 'paper'), 'a');
  assert.equal(rpsThrowWinner('paper', 'rock'), 'a');
  assert.equal(rpsThrowWinner('scissors', 'rock'), 'b');
  assert.equal(rpsThrowWinner('rock', 'rock'), null);
  assert.equal(rpsThrowWinner(null, 'paper'), 'b');
  assert.equal(rpsThrowWinner('paper', null), 'a');
  assert.equal(rpsThrowWinner(null, null), null);
});

test('isRpsHand accepts only the three hands; randomRpsHand returns one', () => {
  assert.ok(isRpsHand('rock') && isRpsHand('paper') && isRpsHand('scissors'));
  assert.ok(!isRpsHand('Rock') && !isRpsHand('') && !isRpsHand(undefined));
  assert.ok(isRpsHand(randomRpsHand(() => 0.999)));
});

test('mathQuestion: factors in range, 4 different positive options including the product', () => {
  for (let i = 0; i < 500; i++) {
    const { a, b, options } = mathQuestion();
    for (const f of [a, b]) assert.ok(f >= MATH_FACTOR.min && f <= MATH_FACTOR.max && Number.isInteger(f));
    assert.equal(options.length, CHOICE_COUNT);
    assert.equal(new Set(options).size, CHOICE_COUNT);
    assert.ok(options.includes(a * b));
    for (const o of options) assert.ok(o > 0);
  }
});

test('potion: sequence long enough for the last level, valid ingredients, never the same twice in a row', () => {
  for (let run = 0; run < 50; run++) {
    const seq = potionSequence();
    assert.equal(seq.length, potionLength(POTION_MAX_LEVEL));
    seq.forEach((n, i) => {
      assert.ok(n >= 0 && n < POTION_INGREDIENTS);
      if (i) assert.notEqual(n, seq[i - 1]);
    });
  }
  assert.equal(potionLength(1), 3);
});

test('potion: decided when nobody brews, at the last level, or when a team is out and already behind', () => {
  const w = (color: 'blue' | 'red', best: number, out: boolean) => ({ color, best, out });
  assert.equal(potionDecided([w('blue', 2, false), w('red', 2, false)], 3), false);
  assert.equal(potionDecided([w('blue', 2, true), w('red', 2, true)], 3), true); // nobody left
  assert.equal(potionDecided([w('blue', 2, true), w('red', 3, false)], 4), true); // red out of reach
  assert.equal(potionDecided([w('blue', 2, true), w('red', 2, false)], 3), false); // red must still beat 2
  assert.equal(potionDecided([w('blue', 9, false), w('red', 9, false)], POTION_MAX_LEVEL), true);
  // Teams: blue averages (4 + 1) / 2 = 2.5, both out; red still brewing at 2 → keep going.
  assert.equal(potionDecided([w('blue', 4, true), w('blue', 1, true), w('red', 2, false)], 3), false);
});

test('rune: layout has every rune once; target never repeats; first to 3 wins, else best after 5', () => {
  for (let run = 0; run < 30; run++) {
    assert.deepEqual([...runeLayout()].sort(), Array.from({ length: RUNE_COUNT }, (_, i) => i));
    const prev = run % RUNE_COUNT;
    assert.notEqual(randomRune(prev), prev);
  }
  assert.equal(runeRoundWinner({ blue: 3, red: 1 }, 4), 'blue');
  assert.equal(runeRoundWinner({ blue: 2, red: 1 }, 3), undefined);
  assert.equal(runeRoundWinner({ blue: 2, red: 1 }, 5), 'blue'); // a flash nobody caught
  assert.equal(runeRoundWinner({ blue: 2, red: 2 }, 5), null);
  assert.equal(runeRoundWinner({ blue: 0, cpu: 3 }, 3), 'cpu');
});
