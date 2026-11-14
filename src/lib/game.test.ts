import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameScore, gameWinner, roundLabel, drawReason, winDetail, isGameOver, trainingSummary, formatSeconds, type RoundResults } from './game';

test('a versus game is always 3 rounds, then the most round wins takes it (level = drawn game)', () => {
  const cases: Array<[RoundResults, 'blue' | 'red' | null, boolean]> = [
    [[], null, false],
    [['blue'], null, false],
    [['blue', 'blue'], null, false], // 2-0 still plays round 3
    [['blue', 'blue', 'red'], 'blue', true],
    [['blue', 'blue', 'blue'], 'blue', true],
    [['red', 'blue', 'red'], 'red', true],
    [['blue', null, null], 'blue', true], // ahead 1-0 after 3
    [['blue', null, 'red'], null, true], // 1-1 after 3: drawn game, no extra round
    [[null, null, null], null, true],
  ];
  for (const [results, winner, over] of cases) {
    assert.equal(gameWinner(results), winner, JSON.stringify(results));
    assert.equal(isGameOver(results, false), over, JSON.stringify(results));
  }
});

test('gameScore counts wins and draws', () => {
  assert.deepEqual(gameScore(['blue', null, 'red', 'blue']), { blue: 2, red: 1, draws: 1 });
});

test('roundLabel counts out of 3', () => {
  assert.equal(roundLabel(1), 'Round 1 of 3');
  assert.equal(roundLabel(3), 'Round 3 of 3');
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

test('training: never over on its own (goes on until the wizard quits), with a solved/failed summary', () => {
  const four: RoundResults = ['blue', null, 'blue', 'blue'];
  assert.equal(isGameOver(four, true), false);
  assert.equal(isGameOver(Array(50).fill('blue'), true), false);
  assert.equal(isGameOver(['blue', 'blue'], true), false); // versus would be over at 2 wins
  assert.equal(isGameOver(['blue', 'blue', null], false), true);
  assert.deepEqual(trainingSummary([...four, null], [2100, null, 1840, 3000, null]), { played: 5, solved: 3, failed: 2, best: 1840 });
  assert.deepEqual(trainingSummary([null, null], [null, null]), { played: 2, solved: 0, failed: 2, best: null });
  assert.equal(roundLabel(12, true), 'Training · Round 12');
  assert.equal(formatSeconds(1840), '1.84 s');
  assert.equal(drawReason({ mode: 'translate', allWrong: true, results: {}, game: { training: true } }), 'Wrong answer');
});
