import { nanoid } from 'nanoid';
import type { Room, RoomState } from '@/types/game';

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
    maxPlayers: 2,
    graceTimerStarted: false,
    firstCorrectAt: null,
    round: 0,
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function deleteRoom(id: string): void {
  rooms.delete(id);
}

export function allRooms(): Room[] {
  return Array.from(rooms.values());
}
