import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, getRoom, sweepAbandonedRooms } from './rooms';

const LIMIT = 10_000;

test('sweepAbandonedRooms deletes only rooms with nobody connected for the whole limit', () => {
  const empty = createRoom('host-a').id;
  const busy = createRoom('host-b').id;
  const comesBack = createRoom('host-c').id;
  const connected = new Set([busy]);
  const count = (id: string) => (connected.has(id) ? 1 : 0);

  assert.deepEqual(sweepAbandonedRooms(count, LIMIT, 0), []); // first time seen empty: clock starts
  assert.deepEqual(sweepAbandonedRooms(count, LIMIT, LIMIT - 1), []);

  connected.add(comesBack); // someone reconnects: its clock resets
  sweepAbandonedRooms(count, LIMIT, LIMIT - 1);
  connected.delete(comesBack);

  assert.deepEqual(sweepAbandonedRooms(count, LIMIT, LIMIT), [empty]);
  assert.equal(getRoom(empty), undefined);
  assert.ok(getRoom(busy));
  assert.ok(getRoom(comesBack));

  // Its clock restarted at LIMIT (first sweep seeing it empty again), so it goes at 2 * LIMIT.
  assert.deepEqual(sweepAbandonedRooms(count, LIMIT, 2 * LIMIT - 1), []);
  assert.deepEqual(sweepAbandonedRooms(count, LIMIT, 2 * LIMIT), [comesBack]);
  assert.ok(getRoom(busy));
});
