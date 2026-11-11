import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameScore, gameWinner, roundLabel, type RoundResults } from './game';

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
