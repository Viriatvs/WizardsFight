import { nanoid } from 'nanoid';
import type { Room, RoomState } from '@/types/game';
import { MAX_PLAYERS } from './teams';

const rooms = new Map<string, Room>();

export function createRoom(hostSocketId: string): Room {
  const id = nanoid(6);
  const room: Room = {
    id,
    hostSocketId,
    players: new Map(),
    state: 'waiting' as RoomState,
    spell: { latin: '', english: '', description: '', category: '' },
    startedAt: null,
    spellRevealedAt: null,
    submissions: new Map(),
    maxPlayers: MAX_PLAYERS,
    graceTimerStarted: false,
    firstCorrectAt: null,
    round: 0,
    mode: null,
    lockedOut: new Set(),
    roundResults: [],
    modesUsed: [],
    math: { questions: [], progress: new Map() },
    roundTimes: [],
    solo: false,
    puzzleImage: null,
    rps: { throw: 0, open: false, picks: new Map(), wins: new Map(), idleThrows: 0 },
    foundWords: new Map(),
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function deleteRoom(id: string): void {
  rooms.delete(id);
  emptySince.delete(id);
}

/** Room id → when we first saw it with no screen (host or phone) connected. */
const emptySince = new Map<string, number>();

/**
 * Deletes rooms that have had no connected screen for `abandonedAfterMs`.
 * Call it periodically; returns the ids it deleted.
 */
export function sweepAbandonedRooms(connectedCount: (roomId: string) => number, abandonedAfterMs: number, now = Date.now()): string[] {
  const deleted: string[] = [];
  for (const id of rooms.keys()) {
    if (connectedCount(id) > 0) {
      emptySince.delete(id);
      continue;
    }
    const since = emptySince.get(id) ?? now;
    emptySince.set(id, since);
    if (now - since >= abandonedAfterMs) {
      deleteRoom(id);
      deleted.push(id);
    }
  }
  return deleted;
}
