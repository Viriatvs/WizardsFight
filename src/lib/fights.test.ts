import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fightDate, fightSentence, type FightRecord } from './fights';
import { readFights, saveFight, MAX_FIGHTS } from './fightStore';

const fight = (id: string, at = '2026-11-05T21:30:00.000Z', rounds = 5): FightRecord => ({
  id, at, rounds, draws: 1,
  winner: { name: 'Merlin', color: 'blue' },
  loser: { name: 'Morgana', color: 'red' },
  score: { winner: 2, loser: 1 },
});

test('fightDate uses ordinal days', () => {
  assert.equal(fightDate('2026-11-05T12:00:00Z'), 'November 5th 2026');
  assert.equal(fightDate('2026-11-01T12:00:00Z'), 'November 1st 2026');
  assert.equal(fightDate('2026-11-02T12:00:00Z'), 'November 2nd 2026');
  assert.equal(fightDate('2026-11-03T12:00:00Z'), 'November 3rd 2026');
  assert.equal(fightDate('2026-11-11T12:00:00Z'), 'November 11th 2026');
  assert.equal(fightDate('2026-11-12T12:00:00Z'), 'November 12th 2026');
  assert.equal(fightDate('2026-11-13T12:00:00Z'), 'November 13th 2026');
  assert.equal(fightDate('2026-11-21T12:00:00Z'), 'November 21st 2026');
  assert.equal(fightDate('2026-11-22T12:00:00Z'), 'November 22nd 2026');
});

test('fightSentence matches the requested wording', () => {
  assert.equal(fightSentence(fight('a')), 'Merlin won against Morgana with 5 rounds on November 5th 2026');
});

test('fight store: newest first, survives a missing or broken file, keeps at most MAX_FIGHTS', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fights-'));
  const file = path.join(dir, 'nested', 'fights.json');
  assert.deepEqual(readFights(file), []); // missing file and folder
  saveFight(fight('1'), file);
  saveFight(fight('2'), file);
  assert.deepEqual(readFights(file).map((f) => f.id), ['2', '1']);

  fs.writeFileSync(file, '{not json');
  assert.deepEqual(readFights(file), []); // broken file set aside
  assert.equal(fs.readdirSync(path.dirname(file)).filter((n) => n.includes('.corrupt-')).length, 1);

  for (let i = 0; i < MAX_FIGHTS + 5; i++) saveFight(fight(String(i)), file);
  const all = readFights(file);
  assert.equal(all.length, MAX_FIGHTS);
  assert.equal(all[0].id, String(MAX_FIGHTS + 4));
  fs.rmSync(dir, { recursive: true, force: true });
});
