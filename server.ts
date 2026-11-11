import http from 'http';
import next from 'next';
import { Server, Socket } from 'socket.io';
import { createRoom, getRoom, sweepAbandonedRooms } from './src/lib/rooms';
import { randomSpell, SPELLS } from './src/lib/spells';
import { validateSubmission, determineWinner } from './src/lib/scoring';
import {
  randomMode, buildChoices, maskSpell, scramblePuzzle, isSolved, PUZZLE,
  hangmanStart, hangmanNextLetter, matchWords, maskWords, lettersFound, spellWordCount,
} from './src/lib/modes';
import { gameScore, gameWinner } from './src/lib/game';
import type { Room, Player, PlayerColor, Submission, SpellReveal, GameInfo, BattleEnd } from './src/types/game';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const COUNTDOWN_STEP_MS = 1000;
const TYPE_LIMIT_MS = 30000;
const GRACE_MS = 3000;
const CHOICE_LIMIT_MS = 15000;
const HANGMAN_STEP_MS = 1000;
const HANGMAN_AFTER_FULL_MS = 40000;
const MEMORIZE_SHOW_MS = 5000;
const MEMORIZE_LIMIT_MS = 30000;
const PUZZLE_LIMIT_MS = 60000;
const ROOM_ABANDONED_MS = 10 * 60 * 1000;
const ROOM_SWEEP_INTERVAL_MS = 60 * 1000;

const app = next({ dev });
const handle = app.getRequestHandler();

function gameInfo(room: Room): GameInfo {
  const results = room.roundResults;
  const inRound = room.state === 'countdown' || room.state === 'playing';
  return { round: results.length + (inRound ? 1 : 0), results, score: gameScore(results), winner: gameWinner(results) };
}

function roomToPayload(room: Room) {
  const players: Array<{ color: string; name: string; socketId: string; rematchReady: boolean; fightReady: boolean }> = [];
  for (const player of room.players.values()) {
    players.push({ color: player.color, name: player.name, socketId: player.socketId, rematchReady: player.rematchReady, fightReady: player.fightReady });
  }
  // Never include the spell here: room:update goes to everyone and would leak the answer.
  return {
    id: room.id,
    state: room.state,
    mode: room.state === 'waiting' ? null : room.mode,
    players,
    playerCount: room.players.size,
    maxPlayers: room.maxPlayers,
    spellRevealedAt: room.spellRevealedAt,
    startedAt: room.startedAt,
    game: gameInfo(room),
  };
}

// room.spell and room.mode are kept so the next round can avoid repeating them.
function resetRoom(room: Room) {
  room.state = 'waiting';
  room.startedAt = null;
  room.spellRevealedAt = null;
  room.submissions.clear();
  room.lockedOut.clear();
  room.memorizeFound.clear();
  room.graceTimerStarted = false;
  room.firstCorrectAt = null;
  for (const p of room.players.values()) { p.rematchReady = false; p.fightReady = false; }
}

/** The single way a round ends: records it in the current game. Ignored if the round already ended. */
function endBattle(io: Server, room: Room, winner: Player | null, extra: Record<string, boolean> = {}) {
  if (room.state !== 'playing') return;
  room.state = 'ended';
  room.roundResults.push(winner?.color ?? null);
  const results: BattleEnd['results'] = {};
  for (const p of room.players.values()) {
    const sub = room.submissions.get(p.socketId);
    results[p.socketId] = { color: p.color, name: p.name, durationMs: sub?.durationMs ?? -1, correct: !!sub || p === winner };
    if (room.mode === 'memorize') results[p.socketId].letters = lettersFound(room.spell.latin, room.memorizeFound.get(p.socketId) ?? []);
  }
  const payload: BattleEnd = {
    winnerColor: winner?.color ?? null,
    winnerName: winner?.name ?? null,
    durationMs: winner ? room.submissions.get(winner.socketId)?.durationMs ?? null : null,
    results,
    game: gameInfo(room),
    mode: room.mode,
    ...extra,
  };
  io.to(room.id).emit('battle:end', payload);
  console.log(`[room ${room.id}] round ${payload.game.round} (${room.mode}) winner: ${winner?.color ?? 'none'}, game winner: ${payload.game.winner ?? '-'} ${JSON.stringify(extra)}`);
}

/**
 * A player leaves (Exit button or disconnect). Mid-round it's a forfeit. If the game isn't over,
 * it's cancelled: score cleared and the room goes back to waiting for players.
 * After a finished game nothing is reset, so the other phone keeps its final score table.
 */
function removePlayer(io: Server, room: Room, socketId: string) {
  const player = room.players.get(socketId);
  if (!player) return;
  io.to(room.id).emit('player:disconnected', { color: player.color, name: player.name });
  if (room.state === 'playing') {
    const other = Array.from(room.players.values()).find((p) => p.socketId !== socketId) ?? null;
    endBattle(io, room, other, { forfeit: true });
  }
  room.players.delete(socketId);
  const gameOver = room.state === 'ended' && gameWinner(room.roundResults) !== null;
  if (!gameOver) {
    room.roundResults = [];
    resetRoom(room);
  }
  io.to(room.id).emit('room:update', roomToPayload(room));
  console.log(`[room ${room.id}] ${player.color} left${gameOver ? '' : ' — game cancelled'}`);
}

/** Runs fn after ms, unless the round has moved on or ended meanwhile. */
function laterInRound(room: Room, ms: number, fn: () => void) {
  const round = room.round;
  setTimeout(() => {
    if (room.round === round && room.state === 'playing') fn();
  }, ms);
}

/** Memorize time limit: nobody completed the spell, so more correct letters wins; equal letters is a draw. */
function endMemorizeOnLetters(io: Server, room: Room) {
  const scored = Array.from(room.players.values())
    .map((p) => ({ p, letters: lettersFound(room.spell.latin, room.memorizeFound.get(p.socketId) ?? []) }))
    .sort((a, b) => b.letters - a.letters);
  const [best, second] = scored;
  if (best && best.letters > (second?.letters ?? 0)) endBattle(io, room, best.p, { onLetters: true });
  else endBattle(io, room, null, { timedOut: true });
}

function drawAfter(io: Server, room: Room, ms: number) {
  laterInRound(room, ms, () => endBattle(io, room, null, { timedOut: true }));
}

function revealSpell(io: Server, room: Room) {
  const spell = room.spell;
  const revealedAt = room.spellRevealedAt!;
  const emit = (payload: SpellReveal) => io.to(room.id).emit('spell:reveal', payload);
  const { category, english, latin } = spell;

  switch (room.mode) {
    case 'translate':
    case 'describe': {
      const field = room.mode === 'translate' ? 'english' : 'description';
      emit({ mode: room.mode, latin, category, options: buildChoices(spell, SPELLS, field), revealedAt, limitMs: CHOICE_LIMIT_MS });
      drawAfter(io, room, CHOICE_LIMIT_MS);
      return;
    }
    case 'hangman': {
      // Starts with each word's first letter; then last letters, then random ones (hangmanNextLetter).
      let masked = hangmanStart(latin);
      emit({ mode: 'hangman', masked, english, category, revealedAt });
      const round = room.round;
      const tick = setInterval(() => {
        if (room.round !== round || room.state !== 'playing') return clearInterval(tick);
        masked = hangmanNextLetter(latin, masked);
        const full = !masked.includes('_');
        io.to(room.id).emit('spell:hint', full ? { masked, limitMs: HANGMAN_AFTER_FULL_MS } : { masked });
        if (full) {
          clearInterval(tick);
          drawAfter(io, room, HANGMAN_AFTER_FULL_MS);
        }
      }, HANGMAN_STEP_MS);
      return;
    }
    case 'memorize': {
      emit({ mode: 'memorize', latin, masked: maskSpell(latin), english, category, revealedAt, memorizeMs: MEMORIZE_SHOW_MS });
      laterInRound(room, MEMORIZE_SHOW_MS, () => io.to(room.id).emit('spell:hide', { limitMs: MEMORIZE_LIMIT_MS }));
      laterInRound(room, MEMORIZE_SHOW_MS + MEMORIZE_LIMIT_MS, () => endMemorizeOnLetters(io, room));
      return;
    }
    case 'puzzle': {
      emit({ mode: 'puzzle', ...PUZZLE, order: scramblePuzzle(), revealedAt, limitMs: PUZZLE_LIMIT_MS });
      drawAfter(io, room, PUZZLE_LIMIT_MS);
      return;
    }
    default:
      emit({ mode: 'type', spell, revealedAt });
      drawAfter(io, room, TYPE_LIMIT_MS);
  }
}

function startBattle(io: Server, room: Room) {
  if (room.state !== 'waiting' || room.players.size < room.maxPlayers) return;

  room.round++;
  room.state = 'countdown';
  room.startedAt = Date.now();
  room.mode = randomMode(room.mode);
  room.spell = randomSpell(room.spell.latin || undefined);
  io.to(room.id).emit('room:update', roomToPayload(room));

  const sequence = [3, 2, 1];
  let step = 0;

  const interval = setInterval(() => {
    // A player left during the countdown (the room went back to waiting): stop.
    if (room.state !== 'countdown') return clearInterval(interval);
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
      revealSpell(io, room);
      console.log(`[room ${room.id}] ${room.mode}: ${room.spell.latin}`);
    }
  }, COUNTDOWN_STEP_MS);
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

    // Lets a page find out whether a room still exists before showing anything.
    socket.on('room:check', (payload: { roomId: string }, cb?: (result: { exists: boolean }) => void) => {
      if (cb) cb({ exists: !!getRoom(payload?.roomId) });
    });

    socket.on('room:watch', (payload: { roomId: string }, cb?: (result: { success: boolean; data?: ReturnType<typeof roomToPayload>; error?: string; notFound?: boolean }) => void) => {
      const room = getRoom(payload.roomId);
      if (!room) {
        if (cb) cb({ success: false, error: 'Room not found', notFound: true });
        return;
      }
      room.hostSocketId = socket.id;
      socket.data.roomId = room.id;
      socket.data.role = 'host';
      socket.join(room.id);
      if (cb) cb({ success: true, data: roomToPayload(room) });
    });

    socket.on('room:join', (payload: { roomId: string; name?: string; color?: PlayerColor }, cb?: (result: { success: boolean; color?: PlayerColor; error?: string; notFound?: boolean }) => void) => {
      const room = getRoom(payload.roomId);
      if (!room) {
        if (cb) cb({ success: false, error: 'Room not found', notFound: true });
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

      const player = { socketId: socket.id, color, name, joinedAt: Date.now(), rematchReady: false, fightReady: false };
      room.players.set(socket.id, player);
      socket.data.roomId = room.id;
      socket.data.role = 'player';
      socket.join(room.id);

      if (cb) cb({ success: true, color });

      io.to(room.id).emit('room:update', roomToPayload(room));
      console.log(`[room ${room.id}] ${color} joined: ${socket.id}`);

      // A new player fills a slot freed after a finished game: a fresh game starts.
      if (room.state === 'ended') {
        room.roundResults = [];
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
      const player = room.players.get(socket.id);
      if (!player || room.submissions.has(socket.id) || room.lockedOut.has(socket.id)) return;

      const submittedAt = Date.now();
      const durationMs = submittedAt - room.spellRevealedAt;
      // Memorize: the spell is still on screen, so typing it now doesn't count.
      if (room.mode === 'memorize' && durationMs < MEMORIZE_SHOW_MS) return;

      // Memorize: any correct words are revealed for this player only; they win once every word is found.
      if (room.mode === 'memorize') {
        const latin = room.spell.latin;
        const before = room.memorizeFound.get(socket.id) ?? [];
        const found = matchWords(latin, String(payload.text), before);
        room.memorizeFound.set(socket.id, found);
        const total = spellWordCount(latin);
        if (found.length < total) {
          if (found.length > before.length) {
            io.to(socket.id).emit('spell:progress', { masked: maskWords(latin, found), found: found.length, total });
          } else {
            io.to(socket.id).emit('spell:submitted', { correct: false, durationMs, lockedOut: false });
          }
          return;
        }
      }

      const isChoice = room.mode === 'translate' || room.mode === 'describe';
      // Puzzle: the phone sends its final tile order ("0,1,2,…") once the picture is complete.
      // ponytail: the server trusts the phone's arrangement; replaying swaps would not stop a determined cheater either.
      const correct = room.mode === 'memorize'
        ? true // only reached once every word was found (above)
        : room.mode === 'puzzle'
        ? isSolved(String(payload.text).split(',').map(Number))
        : isChoice
          ? payload.text === (room.mode === 'translate' ? room.spell.english : room.spell.description)
          : validateSubmission(payload.text, room.spell);

      if (!correct) {
        // Choice modes: one pick per round. Typing modes: retry freely.
        if (isChoice) room.lockedOut.add(socket.id);
        io.to(socket.id).emit('spell:submitted', { correct: false, durationMs, lockedOut: isChoice });
        console.log(`[room ${room.id}] ${player.color} wrong: "${payload.text}"`);
        if (isChoice && room.lockedOut.size >= room.players.size) endBattle(io, room, null, { allWrong: true });
        return;
      }

      const submission: Submission = { socketId: socket.id, text: payload.text, submittedAt, spellRevealedAt: room.spellRevealedAt, durationMs, correct, valid: true };
      room.submissions.set(socket.id, submission);
      console.log(`[room ${room.id}] ${player.color} correct: duration=${durationMs}ms`);
      io.to(socket.id).emit('spell:submitted', { correct: true, durationMs });

      // Only Speed Cast waits for the opponent; every other mode ends on the first correct answer.
      if (room.mode !== 'type') return endBattle(io, room, player);

      if (room.submissions.size >= room.maxPlayers) {
        const result = determineWinner(room.submissions, room.players);
        const winner = Array.from(room.players.values()).find((p) => p.color === result.winnerColor) ?? null;
        return endBattle(io, room, winner);
      }

      if (!room.graceTimerStarted) {
        room.graceTimerStarted = true;
        room.firstCorrectAt = submittedAt;
        io.to(room.id).emit('grace', { seconds: GRACE_MS / 1000 });
        laterInRound(room, GRACE_MS, () => endBattle(io, room, player, { graceTimeout: true }));
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

      // Same event for "Next round" (game still going) and "Fight again" (game over: a new game starts at 0-0).
      player.rematchReady = true;
      const gameOver = gameWinner(room.roundResults) !== null;
      console.log(`[room ${room.id}] ${player.color} pressed ${gameOver ? 'Fight again' : 'Next round'}`);

      const allReady = Array.from(room.players.values()).every((p) => p.rematchReady);

      if (allReady) {
        if (gameOver) room.roundResults = [];
        resetRoom(room);
        // Pressing Next round / Fight again already means "ready": screens show "starting" instead of Let's Fight.
        for (const p of room.players.values()) p.fightReady = true;
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

      if (!room.players.has(socket.id)) return;
      socket.data.roomId = undefined;
      socket.data.role = undefined;
      socket.leave(room.id);
      removePlayer(io, room, socket.id);
    });

    socket.on('disconnect', () => {
      const data = socket.data as { roomId?: string; role?: string };
      if (data?.role !== 'player' || !data.roomId) return;
      const room = getRoom(data.roomId);
      if (room) removePlayer(io, room, socket.id);
    });
  });

  // A room is abandoned once no screen (host or phone) has been connected to it for ROOM_ABANDONED_MS.
  // Pages that later open it get redirected to the start page.
  setInterval(() => {
    const deleted = sweepAbandonedRooms((id) => io.sockets.adapter.rooms.get(id)?.size ?? 0, ROOM_ABANDONED_MS);
    for (const id of deleted) console.log(`[room ${id}] deleted (abandoned)`);
  }, ROOM_SWEEP_INTERVAL_MS);

  server.listen(port, () => {
    console.log(`Wizards Fight running on http://localhost:${port}`);
  });
});
