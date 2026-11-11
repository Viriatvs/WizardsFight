import http from 'http';
import next from 'next';
import { Server, Socket } from 'socket.io';
import { createRoom, getRoom, deleteRoom } from './src/lib/rooms';
import { randomSpell } from './src/lib/spells';
import { validateSubmission, determineWinner } from './src/lib/scoring';
import type { Room, PlayerColor, Submission } from './src/types/game';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

function roomToPayload(room: Room) {
  const players: Array<{ color: string; name: string; socketId: string; wins: number; rematchReady: boolean; fightReady: boolean }> = [];
  for (const player of room.players.values()) {
    players.push({ color: player.color, name: player.name, socketId: player.socketId, wins: player.wins, rematchReady: player.rematchReady, fightReady: player.fightReady });
  }
  return {
    id: room.id,
    state: room.state,
    players,
    playerCount: room.players.size,
    maxPlayers: room.maxPlayers,
    spell: room.state === 'playing' ? room.spell : undefined,
    spellRevealedAt: room.spellRevealedAt,
    startedAt: room.startedAt,
  };
}

function resetRoom(room: Room) {
  room.state = 'waiting';
  room.spell = { latin: '', english: '', description: '', category: '' };
  room.startedAt = null;
  room.spellRevealedAt = null;
  room.submissions.clear();
  room.graceTimerStarted = false;
  room.firstCorrectAt = null;
  for (const p of room.players.values()) { p.rematchReady = false; p.fightReady = false; }
}

function applyWins(room: Room, winnerColor: PlayerColor | null) {
  for (const player of room.players.values()) {
    if (winnerColor && player.color === winnerColor) {
      player.wins++;
    } else {
      player.wins = 0;
    }
  }
}

function getWinsPayload(room: Room) {
  const wins: Record<string, number> = {};
  for (const player of room.players.values()) {
    wins[player.color] = player.wins;
  }
  return wins;
}

function startBattle(io: Server, room: Room) {
  if (room.state !== 'waiting' || room.players.size < room.maxPlayers) return;

  room.round++;
  room.state = 'countdown';
  room.startedAt = Date.now();
  io.to(room.id).emit('room:update', roomToPayload(room));

  const prevLatin = room.spell && room.spell.latin ? room.spell.latin : undefined;
  const spell = randomSpell(prevLatin);
  room.spell = spell;

  const sequence = [3, 2, 1];
  let step = 0;

  const interval = setInterval(() => {
    if (step < sequence.length) {
      io.to(room.id).emit('countdown', { seconds: sequence[step] });
      step++;
    } else if (step === sequence.length) {
      io.to(room.id).emit('fight', { text: 'FIGHT' });
      step++;
    } else {
      clearInterval(interval);
      room.state = 'playing';
      room.spellRevealedAt = Date.now();
      io.to(room.id).emit('room:update', roomToPayload(room));
      io.to(room.id).emit('spell:reveal', { spell, revealedAt: room.spellRevealedAt });
      console.log(`[room ${room.id}] spell revealed: ${spell.latin}`);

      const currentRound = room.round;
      setTimeout(() => {
        if (room.round !== currentRound || room.state !== 'playing') return;
        room.state = 'ended';
        applyWins(room, null);
        const results: Record<string, { color: PlayerColor; name: string; durationMs: number; correct: boolean; wins: number }> = {};
        for (const player of room.players.values()) {
          results[player.socketId] = { color: player.color, name: player.name, durationMs: -1, correct: false, wins: player.wins };
        }
        io.to(room.id).emit('battle:end', { winnerColor: null, winnerName: null, durationMs: null, results, timedOut: true, wins: getWinsPayload(room) });
        console.log(`[room ${room.id}] timed out`);
      }, 30000);
    }
  }, 1000);
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket.io',
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    socket.on('room:create', (cb?: (result: { roomId: string }) => void) => {
      const room = createRoom(socket.id);
      if (cb) cb({ roomId: room.id });
    });

    socket.on('room:watch', (payload: { roomId: string }, cb?: (result: { success: boolean; data?: ReturnType<typeof roomToPayload>; error?: string }) => void) => {
      const room = getRoom(payload.roomId);
      if (!room) {
        if (cb) cb({ success: false, error: 'Room not found' });
        return;
      }
      room.hostSocketId = socket.id;
      socket.data.roomId = room.id;
      socket.data.role = 'host';
      socket.join(room.id);
      if (cb) cb({ success: true, data: roomToPayload(room) });
    });

    socket.on('room:join', (payload: { roomId: string; name?: string; color?: PlayerColor }, cb?: (result: { success: boolean; color?: PlayerColor; error?: string }) => void) => {
      const room = getRoom(payload.roomId);
      if (!room) {
        if (cb) cb({ success: false, error: 'Room not found' });
        return;
      }
      if (room.state === 'countdown' || room.state === 'playing') {
        if (cb) cb({ success: false, error: 'Battle already started' });
        return;
      }
      if (room.state === 'ended' && room.players.size >= room.maxPlayers) {
        if (cb) cb({ success: false, error: 'Room is full (max 2 players)' });
        return;
      }
      if (room.state === 'waiting' && room.players.size >= room.maxPlayers) {
        if (cb) cb({ success: false, error: 'Room is full (max 2 players)' });
        return;
      }

      const colors: PlayerColor[] = ['blue', 'red'];
      const usedColors = new Set(room.players.values().map((p) => p.color));
      let color: PlayerColor | undefined;
      if (payload.color && !usedColors.has(payload.color)) {
        color = payload.color;
      } else {
        color = colors.find((c) => !usedColors.has(c));
      }
      if (!color) {
        if (cb) cb({ success: false, error: 'Room is full (max 2 players)' });
        return;
      }
      const name = payload.name?.trim() || (color === 'blue' ? 'Blue Wizard' : 'Red Wizard');

      const player = { socketId: socket.id, color, name, joinedAt: Date.now(), wins: 0, rematchReady: false, fightReady: false };
      room.players.set(socket.id, player);
      socket.data.roomId = room.id;
      socket.data.role = 'player';
      socket.join(room.id);

      if (cb) cb({ success: true, color });

      io.to(room.id).emit('room:update', roomToPayload(room));
      console.log(`[room ${room.id}] ${color} joined: ${socket.id}`);

      if (room.state === 'ended') {
        resetRoom(room);
        io.to(room.id).emit('room:update', roomToPayload(room));
      }

      if (room.players.size >= room.maxPlayers && room.state === 'waiting') {
        console.log(`[room ${room.id}] both players joined — waiting for Let's Fight`);
      }
    });

    socket.on('player:name', (payload: { roomId: string; name: string }, cb?: (result: { success: boolean; error?: string }) => void) => {
      const room = getRoom(payload.roomId);
      if (!room) {
        if (cb) cb({ success: false, error: 'Room not found' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        if (cb) cb({ success: false, error: 'Not in this room' });
        return;
      }
      player.name = payload.name.trim().slice(0, 24) || player.name;
      io.to(room.id).emit('room:update', roomToPayload(room));
      console.log(`[room ${room.id}] ${player.color} named: ${player.name}`);
      if (cb) cb({ success: true });
    });

    socket.on('player:ready', (payload: { roomId: string }, cb?: (result: { success: boolean; error?: string }) => void) => {
      const room = getRoom(payload.roomId);
      if (!room || room.state !== 'waiting') {
        if (cb) cb({ success: false, error: 'Not waiting for battle' });
        return;
      }

      const player = room.players.get(socket.id);
      if (!player) {
        if (cb) cb({ success: false, error: 'Not in this room' });
        return;
      }

      player.fightReady = true;
      console.log(`[room ${room.id}] ${player.color} pressed Let's Fight`);
      io.to(room.id).emit('room:update', roomToPayload(room));

      const allReady = Array.from(room.players.values()).every((p) => p.fightReady);
      if (allReady && room.players.size >= room.maxPlayers) {
        console.log(`[room ${room.id}] both ready — countdown in 2s`);
        setTimeout(() => {
          const r = getRoom(room.id);
          if (r && r.state === 'waiting' && Array.from(r.players.values()).every((p) => p.fightReady)) {
            startBattle(io, r);
          }
        }, 2000);
      }

      if (cb) cb({ success: true });
    });

    socket.on('spell:submit', (payload: { roomId: string; text: string }) => {
      const room = getRoom(payload.roomId);
      if (!room || room.state !== 'playing' || !room.spellRevealedAt) return;

      const submittedAt = Date.now();
      const durationMs = submittedAt - room.spellRevealedAt;
      const correct = validateSubmission(payload.text, room.spell);
      const player = room.players.get(socket.id);

      if (!correct) {
        io.to(socket.id).emit('spell:submitted', { correct: false, durationMs, expected: room.spell.latin, submitted: payload.text });
        console.log(`[room ${room.id}] ${player?.color} wrong attempt: "${payload.text}"`);
        return;
      }

      if (room.submissions.has(socket.id)) return;

      const submission: Submission = {
        socketId: socket.id,
        text: payload.text,
        submittedAt,
        spellRevealedAt: room.spellRevealedAt,
        durationMs,
        correct,
        valid: true,
      };

      room.submissions.set(socket.id, submission);
      console.log(`[room ${room.id}] ${player?.color} correct: duration=${durationMs}ms`);

      io.to(socket.id).emit('spell:submitted', { correct: true, durationMs, expected: room.spell.latin, submitted: payload.text });

      if (room.submissions.size >= room.maxPlayers) {
        room.state = 'ended';
        const result = determineWinner(room.submissions, room.players);
        applyWins(room, result.winnerColor);
        const results: Record<string, { color: PlayerColor; name: string; durationMs: number; correct: boolean; wins: number }> = {};
        for (const [sid, sub] of room.submissions.entries()) {
          const p = room.players.get(sid);
          if (p) results[sid] = { color: p.color, name: p.name, durationMs: sub.durationMs, correct: true, wins: p.wins };
        }
        io.to(room.id).emit('battle:end', {
          winnerColor: result.winnerColor,
          winnerName: result.winnerName,
          durationMs: result.durationMs,
          results,
          wins: getWinsPayload(room),
        });
        console.log(`[room ${room.id}] both correct, winner: ${result.winnerColor}`);
        return;
      }

      if (!room.graceTimerStarted) {
        room.graceTimerStarted = true;
        room.firstCorrectAt = submittedAt;
        io.to(room.id).emit('grace', { seconds: 3 });
        console.log(`[room ${room.id}] grace period 3s for other wizard`);

        const graceRound = room.round;
        setTimeout(() => {
          if (room.round !== graceRound || room.state !== 'playing') return;
          if (room.submissions.size < room.maxPlayers) {
            room.state = 'ended';
            const winner = player;
            applyWins(room, winner?.color ?? null);
            const results: Record<string, { color: PlayerColor; name: string; durationMs: number; correct: boolean; wins: number }> = {};
            for (const [sid, sub] of room.submissions.entries()) {
              const p = room.players.get(sid);
              if (p) results[sid] = { color: p.color, name: p.name, durationMs: sub.durationMs, correct: true, wins: p.wins };
            }
            io.to(room.id).emit('battle:end', {
              winnerColor: winner?.color ?? null,
              winnerName: winner?.name ?? null,
              durationMs: winner ? room.submissions.get(winner.socketId)?.durationMs ?? null : null,
              results,
              graceTimeout: true,
              wins: getWinsPayload(room),
            });
            console.log(`[room ${room.id}] grace timeout, winner: ${winner?.color}`);
          }
        }, 3000);
      }
    });

    socket.on('player:reset', (payload: { roomId: string }, cb?: (result: { success: boolean; error?: string }) => void) => {
      const room = getRoom(payload.roomId);
      if (!room || room.state !== 'ended') {
        if (cb) cb({ success: false, error: 'No active battle to reset' });
        return;
      }

      const player = room.players.get(socket.id);
      if (!player) {
        if (cb) cb({ success: false, error: 'Too late — another wizard took your place' });
        return;
      }

      player.rematchReady = true;
      console.log(`[room ${room.id}] ${player.color} ready for rematch`);

      const allReady = Array.from(room.players.values()).every((p) => p.rematchReady);

      if (allReady) {
        resetRoom(room);
        io.to(room.id).emit('room:update', roomToPayload(room));
        console.log(`[room ${room.id}] rematch — countdown in 2s`);
        setTimeout(() => {
          const r = getRoom(room.id);
          if (r && r.state === 'waiting') startBattle(io, r);
        }, 2000);
      } else {
        io.to(room.id).emit('room:update', roomToPayload(room));
        const waitingFor = Array.from(room.players.values()).filter((p) => !p.rematchReady);
        io.to(room.id).emit('rematch:waiting', { waitingFor: waitingFor.map((p) => p.color) });
        console.log(`[room ${room.id}] waiting for rematch: ${waitingFor.map((p) => p.color).join(', ')}`);
      }

      if (cb) cb({ success: true });
    });

    socket.on('player:exit', (payload: { roomId: string }) => {
      const room = getRoom(payload.roomId);
      if (!room) return;

      const player = room.players.get(socket.id);
      if (player) {
        console.log(`[room ${room.id}] ${player.color} exited`);
        room.players.delete(socket.id);
        socket.data.roomId = undefined;
        socket.data.role = undefined;

        io.to(room.id).emit('player:disconnected', { color: player.color, name: player.name });
        io.to(room.id).emit('room:update', roomToPayload(room));
      }

      if (room.players.size === 0 && room.hostSocketId !== socket.id) {
        setTimeout(() => {
          const r = getRoom(room.id);
          if (r && r.players.size === 0) {
            deleteRoom(room.id);
            console.log(`[room ${room.id}] deleted (empty)`);
          }
        }, 30000);
      }
    });

    socket.on('disconnect', () => {
      const data = socket.data as { roomId?: string; role?: string };
      if (data?.roomId) {
        const room = getRoom(data.roomId);
        if (room) {
          if (data.role === 'player') {
            const player = room.players.get(socket.id);
            if (player) {
              console.log(`[room ${room.id}] ${player.color} disconnected: ${socket.id}`);
              io.to(room.id).emit('player:disconnected', { color: player.color, name: player.name });

              if (room.state === 'playing') {
                room.state = 'ended';
                const others = Array.from(room.players.values()).filter((p) => p.socketId !== socket.id);
                if (others.length > 0) {
                  const winner = others[0];
                  applyWins(room, winner.color);
                  const results: Record<string, { color: PlayerColor; name: string; durationMs: number; correct: boolean; wins: number }> = {
                    [winner.socketId]: { color: winner.color, name: winner.name, durationMs: 0, correct: true, wins: winner.wins },
                  };
                  io.to(room.id).emit('battle:end', { winnerColor: winner.color, winnerName: winner.name, durationMs: null, results, wins: getWinsPayload(room) });
                } else {
                  io.to(room.id).emit('battle:end', { winnerColor: null, winnerName: null, durationMs: null, results: {}, wins: {} });
                }
              }
            }
            room.players.delete(socket.id);
          }

          io.to(room.id).emit('room:update', roomToPayload(room));

          if (room.players.size === 0 && room.hostSocketId !== socket.id) {
            setTimeout(() => {
              const r = getRoom(room.id);
              if (r && r.players.size === 0) {
                deleteRoom(room.id);
                console.log(`[room ${room.id}] deleted (empty)`);
              }
            }, 30000);
          }
        }
      }
    });
  });

  server.listen(port, () => {
    console.log(`Wizards Fight running on http://localhost:${port}`);
  });
});
