import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameScore, gameWinner, roundLabel, drawReason, winDetail, isGameOver, trainingSummary, formatSeconds, type RoundResults } from './game';

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

test('training: over after 5 rounds whatever the results, with a solved/failed summary', () => {
  const four: RoundResults = ['blue', null, 'blue', 'blue'];
  assert.equal(isGameOver(four, true), false);
  assert.equal(isGameOver([...four, null], true), true);
  assert.equal(isGameOver(['blue', 'blue'], true), false); // versus would be over at 2 wins
  assert.equal(isGameOver(['blue', 'blue'], false), true);
  assert.deepEqual(trainingSummary([...four, null], [2100, null, 1840, 3000, null]), { played: 5, solved: 3, failed: 2, best: 1840 });
  assert.deepEqual(trainingSummary([null, null], [null, null]), { played: 2, solved: 0, failed: 2, best: null });
  assert.equal(roundLabel(2, true), 'Training · Round 2 of 5');
  assert.equal(formatSeconds(1840), '1.84 s');
  assert.equal(drawReason({ mode: 'translate', allWrong: true, results: {}, game: { training: true } }), 'Wrong answer');
});
