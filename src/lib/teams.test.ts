import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTeam, bothTeamsPresent, joinNames, teamNames, teamAverages, higherTeam, MAX_TEAM_SIZE } from './teams';
import { majorityHand } from './modes';
import { winDetail, drawReason } from './game';
import type { BattleEnd, PlayerColor } from '@/types/game';

const team = (blue: number, red: number) => [
  ...Array.from({ length: blue }, () => ({ color: 'blue' as PlayerColor })),
  ...Array.from({ length: red }, () => ({ color: 'red' as PlayerColor })),
];

test('pickTeam: preferred team if it has room, else the smaller team, null when full', () => {
  assert.equal(pickTeam([]), 'blue');
  assert.equal(pickTeam(team(1, 0)), 'red');
  assert.equal(pickTeam(team(2, 1)), 'red');
  assert.equal(pickTeam(team(3, 1), 'blue'), 'blue'); // uneven is fine
  assert.equal(pickTeam(team(MAX_TEAM_SIZE, 1), 'blue'), 'red');
  assert.equal(pickTeam(team(MAX_TEAM_SIZE, MAX_TEAM_SIZE), 'red'), null);
});

test('bothTeamsPresent needs at least one wizard per team', () => {
  assert.equal(bothTeamsPresent(team(3, 0)), false);
  assert.equal(bothTeamsPresent(team(3, 1)), true);
});

test('team names join members in order', () => {
  assert.equal(joinNames(['Merlin']), 'Merlin');
  assert.equal(joinNames(['Merlin', 'Ana']), 'Merlin & Ana');
  assert.equal(joinNames(['Merlin', 'Ana', 'Zed']), 'Merlin, Ana & Zed');
  assert.deepEqual(teamNames([{ color: 'blue', name: 'A' }, { color: 'red', name: 'B' }, { color: 'blue', name: 'C' }]), { blue: 'A & C', red: 'B' });
});

test('team averages decide count-based rounds; equal averages are a tie', () => {
  const players = [{ color: 'blue' as const, n: 6 }, { color: 'blue' as const, n: 2 }, { color: 'red' as const, n: 5 }];
  assert.deepEqual(teamAverages(players, (p) => p.n), { blue: 4, red: 5 });
  assert.equal(higherTeam({ blue: 4, red: 5 }), 'red');
  assert.equal(higherTeam({ blue: 4, red: 4 }), null);
});

test('majorityHand: most-picked hand, random among ties, null with no picks', () => {
  assert.equal(majorityHand(['rock', 'paper', 'rock']), 'rock');
  assert.equal(majorityHand([]), null);
  assert.equal(majorityHand(['rock', 'paper'], () => 0), 'rock');
  assert.equal(majorityHand(['rock', 'paper'], () => 0.99), 'paper');
});

test('result texts use team averages', () => {
  const results: BattleEnd['results'] = {
    a: { color: 'blue', name: 'A', durationMs: -1, correct: false, rightAnswers: 6 },
    b: { color: 'blue', name: 'B', durationMs: -1, correct: false, rightAnswers: 3 },
    c: { color: 'red', name: 'C', durationMs: -1, correct: false, rightAnswers: 4 },
  };
  assert.equal(winDetail({ winnerColor: 'blue', results, mode: 'math' }), 'Right answers: 4.5 vs 4');
  assert.equal(drawReason({ mode: 'math', results: { ...results, c: { ...results.c, rightAnswers: 4.5 } } }), 'Same number of right answers (4.5)');
});
