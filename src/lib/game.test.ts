import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameScore, gameWinner, roundLabel, drawReason, winDetail, type RoundResults } from './game';

test('gameWinner: best of 3 with extra rounds while level after 3', () => {
  const cases: Array<[RoundResults, 'blue' | 'red' | null]> = [
    [[], null],
    [['blue'], null],
    [['blue', 'blue'], 'blue'], // 2 wins ends it early
    [['red', 'blue'], null],
    [['red', 'blue', 'red'], 'red'],
    [['blue', null, 'red'], null], // 1-1 after 3: extra round
    [['blue', null, 'red', null], null], // extra round drawn: keep going
    [['blue', null, 'red', null, 'red'], 'red'],
    [['blue', null, null], 'blue'], // ahead 1-0 after 3
    [[null, null, null], null], // 0-0 after 3: extra round
    [[null, null, null, 'blue'], 'blue'],
  ];
  for (const [results, expected] of cases) assert.equal(gameWinner(results), expected, JSON.stringify(results));
});

test('gameScore counts wins and draws', () => {
  assert.deepEqual(gameScore(['blue', null, 'red', 'blue']), { blue: 2, red: 1, draws: 1 });
});

test('roundLabel marks rounds after the third as extra', () => {
  assert.equal(roundLabel(3), 'Round 3');
  assert.equal(roundLabel(4), 'Round 4 · Extra round');
});

test('memorize result texts: win on letters and draw reasons', () => {
  const results = (blue: number, red: number) => ({
    a: { color: 'blue' as const, name: 'A', durationMs: -1, correct: false, letters: blue },
    b: { color: 'red' as const, name: 'B', durationMs: -1, correct: false, letters: red },
  });
  assert.equal(winDetail({ onLetters: true, winnerColor: 'blue', results: results(12, 9) }), 'Won on letters: 12 vs 9');
  assert.equal(winDetail({ winnerColor: 'blue', results: results(12, 9) }), null);
  assert.equal(drawReason({ mode: 'memorize', results: results(7, 7) }), 'Same number of correct letters (7)');
  assert.equal(drawReason({ mode: 'memorize', results: results(0, 0) }), 'Nobody remembered a word');
});
