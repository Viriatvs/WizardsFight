import http from 'http';
import next from 'next';
import { Server, Socket } from 'socket.io';
import { createRoom, getRoom, deleteRoom, sweepAbandonedRooms } from './src/lib/rooms';
import { saveFight } from './src/lib/fightStore';
import { randomSpell, SPELLS } from './src/lib/spells';
import { validateSubmission } from './src/lib/scoring';
import {
  MODES, randomMode, buildChoices, maskSpell, scramblePuzzle, isSolved, PUZZLE, randomPuzzleImage,
  matchWords, lettersFound, spellWordCount, isRpsHand, randomRpsHand, rpsThrowWinner,
  mathQuestion, MATH_TRAINING_TARGET, majorityHand,
  potionSequence, potionLength, potionDecided, POTION_MAX_LEVEL, POTION_TRAINING_TARGET,
  runeLayout, randomRune, runeRoundWinner, RUNE_FLASHES, RUNE_WINS_NEEDED,
} from './src/lib/modes';
import { TEAMS, MAX_TEAM_SIZE, pickTeam, bothTeamsPresent, teamNames, teamSizes, teamAverages, higherTeam } from './src/lib/teams';
import { gameScore, gameWinner, isGameOver } from './src/lib/game';
import type { Room, Player, PlayerColor, SpellReveal, GameInfo, BattleEnd, RpsHand, RpsResult, RpsSide, MathNext, PotionStatus, RuneResult } from './src/types/game';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const COUNTDOWN_STEP_MS = 1000;
const TYPE_LIMIT_MS = 30000;
const GRACE_MS = 3000;
const CHOICE_LIMIT_MS = 15000;
const MEMORIZE_SHOW_MS = 5000;
const MEMORIZE_LIMIT_MS = 30000;
const PUZZLE_LIMIT_MS = 60000;
const RPS_PICK_MS = 3000;
/** How long both hands stay on screen before the next throw (or the round result). */
const RPS_SHOW_MS = 2000;
const RPS_WINS_NEEDED = 2;
/** Throws in a row where nobody picked before the round is a draw. */
const RPS_MAX_IDLE_THROWS = 3;
const CPU = 'cpu';
const MATH_LIMIT_MS = 10000;
/** Potion Mixing: one ingredient shown every step; brewing time grows with the sequence; a pause between levels. */
const POTION_STEP_MS = 800;
const POTION_INPUT_BASE_MS = 3000;
const POTION_INPUT_PER_INGREDIENT_MS = 900;
const POTION_BETWEEN_MS = 1500;
/** Rune Reflex: a random "get ready" wait (no anticipating), time to tap, and how long the result shows. */
const RUNE_READY_MIN_MS = 1200;
const RUNE_READY_MAX_MS = 3000;
const RUNE_FLASH_MS = 2500;
const RUNE_SHOW_MS = 1500;
/** Training: the computer wizard's reaction time. */
const RUNE_CPU_MIN_MS = 650;
const RUNE_CPU_MAX_MS = 1100;
const ROOM_ABANDONED_MS = 5 * 60 * 1000;
const ROOM_SWEEP_INTERVAL_MS = 60 * 1000;

const app = next({ dev });
const handle = app.getRequestHandler();

function gameInfo(room: Room): GameInfo {
  const results = room.roundResults;
  const inRound = room.state === 'countdown' || room.state === 'playing';
  return {
    round: results.length + (inRound ? 1 : 0),
    results,
    score: gameScore(results),
    winner: room.solo ? null : gameWinner(results),
    over: isGameOver(results, room.solo),
    training: room.solo,
    times: room.roundTimes,
  };
}

/** Clears the score: a new game (or training session) starts at round 1. */
function newGame(room: Room) {
  room.roundResults = [];
  room.roundTimes = [];
  room.modesUsed = [];
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
  room.foundWords.clear();
  room.graceTimerStarted = false;
  room.firstCorrectAt = null;
  for (const p of room.players.values()) { p.rematchReady = false; p.fightReady = false; }
}

/** The single way a round ends: records it in the current game. Ignored if the round already ended. */
function endBattle(io: Server, room: Room, winner: Player | null, extra: Record<string, boolean> = {}) {
  if (room.state !== 'playing') return;
  room.state = 'ended';
  room.roundResults.push(winner?.color ?? null);
  room.roundTimes.push(winner ? room.submissions.get(winner.socketId)?.durationMs ?? null : null);
  const results: BattleEnd['results'] = {};
  for (const p of room.players.values()) {
    const sub = room.submissions.get(p.socketId);
    results[p.socketId] = { color: p.color, name: p.name, durationMs: sub?.durationMs ?? -1, correct: !!sub || p === winner };
    if (room.mode === 'memorize') results[p.socketId].letters = lettersFound(room.spell.latin, room.foundWords.get(p.socketId) ?? []);
    if (room.mode === 'math') results[p.socketId].rightAnswers = room.math.progress.get(p.socketId)?.right ?? 0;
    if (room.mode === 'potion') results[p.socketId].potionLevel = room.potion.progress.get(p.socketId)?.best ?? 0;
  }
  const payload: BattleEnd = {
    winnerColor: winner?.color ?? null,
    winnerName: winner ? (extra.teamWin ? teamNames(room.players.values())[winner.color] ?? winner.name : winner.name) : null,
    durationMs: winner ? room.submissions.get(winner.socketId)?.durationMs ?? null : null,
    results,
    game: gameInfo(room),
    mode: room.mode,
    ...(room.mode === 'translate' ? { answer: room.spell.english } : room.mode === 'describe' ? { answer: room.spell.description } : {}),
    ...extra,
  };
  io.to(room.id).emit('battle:end', payload);
  // Screens track the room state from room:update; without this the main screen still thinks the round is on.
  io.to(room.id).emit('room:update', roomToPayload(room));
  console.log(`[room ${room.id}] round ${payload.game.round} (${room.mode}) winner: ${winner?.color ?? 'none'}, game winner: ${payload.game.winner ?? '-'} ${JSON.stringify(extra)}`);
  recordFinishedGame(room, payload);
}

/** Fight History: a finished versus game (not training, not cancelled), won or drawn, is saved to data/fights.json. */
function recordFinishedGame(room: Room, end: BattleEnd) {
  const { game } = end;
  if (room.solo || !game.over) return;
  const names = teamNames(Object.values(end.results));
  const winnerColor: PlayerColor = game.winner ?? 'blue'; // drawn game: blue listed first
  const loserColor: PlayerColor = winnerColor === 'blue' ? 'red' : 'blue';
  const winnerName = names[winnerColor];
  const loserName = names[loserColor];
  if (!winnerName || !loserName) return;
  saveFight({
    id: `${room.id}-${Date.now()}`,
    at: new Date().toISOString(),
    winner: { name: winnerName, color: winnerColor },
    loser: { name: loserName, color: loserColor },
    score: { winner: game.score[winnerColor], loser: game.score[loserColor] },
    draws: game.score.draws,
    rounds: game.results.length,
    ...(game.winner ? {} : { draw: true as const }),
  });
}

/**
 * A player leaves (Exit button or disconnect). While their team still has someone, the battle goes on.
 * If their team is now empty: mid-round it's a forfeit, and an unfinished game is cancelled (score cleared,
 * back to waiting). After a finished game nothing is reset, so the other phones keep the final score table.
 */
function removePlayer(io: Server, room: Room, socketId: string) {
  const player = room.players.get(socketId);
  if (!player) return;
  if (room.solo) return endTraining(io, room, player);
  io.to(room.id).emit('player:disconnected', { color: player.color, name: player.name });
  const teamEmptied = !Array.from(room.players.values()).some((p) => p.color === player.color && p.socketId !== socketId);
  if (room.state === 'playing' && teamEmptied) {
    const other = Array.from(room.players.values()).find((p) => p.color !== player.color) ?? null;
    endBattle(io, room, other, { forfeit: true });
  }
  room.players.delete(socketId);
  const finishedGame = !room.solo && room.state === 'ended' && isGameOver(room.roundResults, false);
  const cancelled = !finishedGame && (room.solo || teamEmptied);
  if (cancelled) {
    room.solo = false;
    newGame(room);
    resetRoom(room);
  }
  io.to(room.id).emit('room:update', roomToPayload(room));
  console.log(`[room ${room.id}] ${player.color} left${cancelled ? ' — game cancelled' : ''}`);
  if (cancelled || finishedGame) return;
  // The others may have been waiting only for this wizard.
  if (room.state === 'playing') checkRoundComplete(io, room);
  else if (room.state === 'ended') continueWhenAllReady(io, room);
  else if (room.state === 'waiting') startWhenAllReady(io, room);
}

/** Every wizard still in the room is in `ids` (submitted, locked out, picked…). */
const everyone = (room: Room, ids: { has(id: string): boolean }) => Array.from(room.players.keys()).every((id) => ids.has(id));

/** Speed Cast: the fastest correct wizard wins for their team. */
function endSpeedCast(io: Server, room: Room) {
  const fastest = Array.from(room.submissions.values()).sort((a, b) => a.durationMs - b.durationMs)[0];
  endBattle(io, room, fastest ? room.players.get(fastest.socketId) ?? null : null);
}

/** After a wizard leaves mid-round: end the round or throw if it was only waiting for them. */
function checkRoundComplete(io: Server, room: Room) {
  if (room.mode === 'type' && room.submissions.size > 0 && everyone(room, room.submissions)) return endSpeedCast(io, room);
  if ((room.mode === 'translate' || room.mode === 'describe') && everyone(room, room.lockedOut)) return endBattle(io, room, null, { allWrong: true });
  if (room.mode === 'rps' && room.rps.open && everyone(room, room.rps.picks)) resolveRpsThrow(io, room);
  if (room.mode === 'potion' && room.potion.open && potionLevelFinished(room)) closePotionLevel(io, room);
  if (room.mode === 'rune' && room.rune.open && everyone(room, room.rune.out)) resolveRuneFlash(io, room, null, null);
}

const PRE_BATTLE_DELAY_MS = 2000;

/** Waiting room: starts the countdown once every wizard pressed Let's Fight and both teams have someone. */
function startWhenAllReady(io: Server, room: Room) {
  const ready = (r: Room) => r.state === 'waiting' && !r.solo && bothTeamsPresent(r.players.values()) && Array.from(r.players.values()).every((p) => p.fightReady);
  if (!ready(room)) return;
  console.log(`[room ${room.id}] everyone ready — countdown in 2s`);
  setTimeout(() => {
    const r = getRoom(room.id);
    if (r && ready(r)) startBattle(io, r);
  }, PRE_BATTLE_DELAY_MS);
}

/** After a round: once every wizard pressed Next round / Fight again, the next round (or a new game) starts. */
function continueWhenAllReady(io: Server, room: Room) {
  if (room.state !== 'ended' || !Array.from(room.players.values()).every((p) => p.rematchReady)) return;
  if (isGameOver(room.roundResults, room.solo)) newGame(room);
  resetRoom(room);
  // Pressing Next round / Fight again already means "ready": screens show "starting" instead of Let's Fight.
  for (const p of room.players.values()) p.fightReady = true;
  io.to(room.id).emit('room:update', roomToPayload(room));
  console.log(`[room ${room.id}] rematch — countdown in 2s`);
  setTimeout(() => {
    const r = getRoom(room.id);
    if (r && r.state === 'waiting') startBattle(io, r);
  }, PRE_BATTLE_DELAY_MS);
}

/** Deletes the room: stops its timers, tells every other screen (room:closed) and empties the Socket.IO room. */
function closeRoom(io: Server, room: Room, except?: Socket) {
  // Every timer checks the round/state before acting, so this stops anything still scheduled.
  room.round++;
  room.state = 'ended';
  (except ? except.to(room.id) : io.to(room.id)).emit('room:closed');
  io.in(room.id).socketsLeave(room.id);
  deleteRoom(room.id);
}

/**
 * The training wizard quits (Quit training, Exit or disconnect): the session goes into the fight history
 * ("Merlin won 7 out of 10 games") and the room is deleted. Rounds still running are not counted.
 */
function endTraining(io: Server, room: Room, player: Player, except?: Socket) {
  const played = room.roundResults.length;
  const solved = room.roundResults.filter((r) => r !== null).length;
  if (played > 0) {
    saveFight({ kind: 'training', id: `${room.id}-${Date.now()}`, at: new Date().toISOString(), player: { name: player.name, color: player.color }, solved, played });
  }
  closeRoom(io, room, except);
  console.log(`[room ${room.id}] training over: ${player.name} solved ${solved}/${played} — room deleted`);
}

/** Runs fn after ms, unless the round has moved on or ended meanwhile. */
function laterInRound(room: Room, ms: number, fn: () => void) {
  const round = room.round;
  setTimeout(() => {
    if (room.round === round && room.state === 'playing') fn();
  }, ms);
}

/** The team with the higher average `value` wins (through its best wizard); equal averages are a draw. */
function endOnTeamAverage(io: Server, room: Room, value: (p: Player) => number, extra: Record<string, boolean> = {}, winTimeMs?: number) {
  const players = Array.from(room.players.values());
  const team = higherTeam(teamAverages(players, value));
  const best = players.filter((p) => p.color === team).sort((a, b) => value(b) - value(a))[0];
  if (!best) return endBattle(io, room, null, { timedOut: true });
  if (winTimeMs !== undefined) recordWinTime(room, best, winTimeMs);
  return endBattle(io, room, best, { ...extra, teamWin: true });
}

/** Memorize time limit: nobody completed the spell, so the team with more correct letters (average) wins. */
function endMemorizeOnLetters(io: Server, room: Room) {
  // Training: only a completed spell counts as solved.
  if (room.solo) return endBattle(io, room, null, { timedOut: true });
  endOnTeamAverage(io, room, (p) => lettersFound(room.spell.latin, room.foundWords.get(p.socketId) ?? []), { onLetters: true });
}

function drawAfter(io: Server, room: Room, ms: number) {
  laterInRound(room, ms, () => endBattle(io, room, null, { timedOut: true }));
}

/** Modes decided by the server (not by a correct answer): stores the winner's time, as a submission would. */
function recordWinTime(room: Room, player: Player, durationMs: number) {
  room.submissions.set(player.socketId, { socketId: player.socketId, text: '', submittedAt: Date.now(), spellRevealedAt: room.spellRevealedAt!, durationMs, correct: true, valid: true });
}

/** MathIsMagic time limit: the team with more right answers (average) wins; equal is a draw. Training passes with MATH_TRAINING_TARGET right. */
function endMathOnAnswers(io: Server, room: Room) {
  const right = (p: Player) => room.math.progress.get(p.socketId)?.right ?? 0;
  if (!room.solo) return endOnTeamAverage(io, room, right, {}, MATH_LIMIT_MS);
  const [player] = room.players.values();
  if (!player || right(player) < MATH_TRAINING_TARGET) return endBattle(io, room, null, { timedOut: true });
  recordWinTime(room, player, MATH_LIMIT_MS);
  endBattle(io, room, player);
}

function startRpsThrow(io: Server, room: Room) {
  const rps = room.rps;
  rps.throw++;
  rps.picks.clear();
  rps.open = true;
  io.to(room.id).emit('rps:throw', { throw: rps.throw, limitMs: RPS_PICK_MS });
  const n = rps.throw;
  laterInRound(room, RPS_PICK_MS, () => { if (rps.throw === n) resolveRpsThrow(io, room); });
}

/** Ends the current throw (everyone picked, or time is up): shows both hands, then the next throw or the round result. */
function resolveRpsThrow(io: Server, room: Room) {
  const rps = room.rps;
  if (!rps.open) return;
  rps.open = false;
  const players = Array.from(room.players.values());
  // Each team throws its most-picked hand. Training: the one wizard against the computer wizard.
  const teamHand = (c: PlayerColor) => majorityHand(players.filter((p) => p.color === c).flatMap((p) => rps.picks.get(p.socketId) ?? []));
  const colors: PlayerColor[] = room.solo ? players.map((p) => p.color) : TEAMS;
  const sides: Array<{ id: string; side: RpsSide; hand: RpsHand | null }> = colors.map((c) => ({ id: c, side: c, hand: teamHand(c) }));
  if (room.solo) sides.push({ id: CPU, side: CPU, hand: randomRpsHand() });
  const [a, b] = sides;
  const w = rpsThrowWinner(a.hand, b.hand);
  const winner = w === 'a' ? a : w === 'b' ? b : null;
  if (winner) rps.wins.set(winner.id, (rps.wins.get(winner.id) ?? 0) + 1);
  rps.idleThrows = !a.hand && !b.hand ? rps.idleThrows + 1 : 0;

  const result: RpsResult = {
    throw: rps.throw,
    hands: Object.fromEntries(sides.map((s) => [s.side, s.hand])),
    winner: winner?.side ?? null,
    wins: Object.fromEntries(sides.map((s) => [s.side, rps.wins.get(s.id) ?? 0])),
  };
  io.to(room.id).emit('rps:result', result);

  const roundWinner = winner && (rps.wins.get(winner.id) ?? 0) >= RPS_WINS_NEEDED ? winner : null;
  laterInRound(room, RPS_SHOW_MS, () => {
    if (roundWinner) {
      // A member of the winning team; none when the computer wizard won (training).
      const player = Array.from(room.players.values()).find((p) => p.color === roundWinner.id) ?? null;
      if (player) recordWinTime(room, player, Date.now() - room.spellRevealedAt!);
      return endBattle(io, room, player, room.solo ? {} : { teamWin: true });
    }
    if (rps.idleThrows >= RPS_MAX_IDLE_THROWS) return endBattle(io, room, null, { timedOut: true });
    startRpsThrow(io, room);
  });
}

const between = (min: number, max: number) => min + Math.floor(Math.random() * (max - min));

function potionStatus(room: Room): PotionStatus {
  const players: PotionStatus['players'] = {};
  for (const p of room.players.values()) {
    const prog = room.potion.progress.get(p.socketId);
    if (prog) players[p.socketId] = { color: p.color, name: p.name, best: prog.best, done: prog.done, out: prog.out };
  }
  return { level: room.potion.level, players };
}

/** Every wizard still in the room finished this level or is out. */
const potionLevelFinished = (room: Room) =>
  Array.from(room.players.keys()).every((id) => {
    const prog = room.potion.progress.get(id);
    return !prog || prog.done || prog.out;
  });

/** Potion Mixing: shows the next, longer sequence to everyone, then opens brewing. */
function startPotionLevel(io: Server, room: Room) {
  const potion = room.potion;
  potion.level++;
  potion.open = false;
  for (const prog of potion.progress.values()) { prog.pos = 0; prog.done = false; }
  const sequence = potion.sequence.slice(0, potionLength(potion.level));
  io.to(room.id).emit('potion:show', { level: potion.level, sequence, stepMs: POTION_STEP_MS });
  io.to(room.id).emit('potion:status', potionStatus(room));
  const level = potion.level;
  laterInRound(room, sequence.length * POTION_STEP_MS + POTION_STEP_MS / 2, () => {
    if (potion.level !== level) return;
    potion.open = true;
    const limitMs = POTION_INPUT_BASE_MS + sequence.length * POTION_INPUT_PER_INGREDIENT_MS;
    io.to(room.id).emit('potion:input', { level, limitMs });
    laterInRound(room, limitMs, () => { if (potion.level === level && potion.open) closePotionLevel(io, room); });
  });
}

/** End of a brewing level: whoever hasn't finished is out. Then the next level, or the round result. */
function closePotionLevel(io: Server, room: Room) {
  const potion = room.potion;
  if (!potion.open) return;
  potion.open = false;
  for (const prog of potion.progress.values()) if (!prog.done) prog.out = true;
  io.to(room.id).emit('potion:status', potionStatus(room));
  laterInRound(room, POTION_BETWEEN_MS, () => {
    const players = Array.from(room.players.values());
    const best = (p: Player) => potion.progress.get(p.socketId)?.best ?? 0;
    const out = (p: Player) => potion.progress.get(p.socketId)?.out ?? true;
    const winTimeMs = Date.now() - room.spellRevealedAt!;
    if (room.solo) {
      const [player] = players;
      if (player && best(player) >= POTION_TRAINING_TARGET) {
        recordWinTime(room, player, winTimeMs);
        return endBattle(io, room, player);
      }
      if (!player || out(player)) return endBattle(io, room, null, { timedOut: true });
      return startPotionLevel(io, room);
    }
    const wizards = players.map((p) => ({ color: p.color, best: best(p), out: out(p) }));
    if (potionDecided(wizards, potion.level)) return endOnTeamAverage(io, room, best, {}, winTimeMs);
    startPotionLevel(io, room);
  });
}

/** Rune Reflex: a random wait ("get ready"), then the target rune and a freshly shuffled grid for every phone. */
function startRuneFlash(io: Server, room: Room) {
  const rune = room.rune;
  rune.flash++;
  rune.open = false;
  rune.out.clear();
  const flash = rune.flash;
  io.to(room.id).emit('rune:ready', { flash });
  laterInRound(room, between(RUNE_READY_MIN_MS, RUNE_READY_MAX_MS), () => {
    if (rune.flash !== flash) return;
    rune.target = randomRune(flash > 1 ? rune.target : null);
    rune.layout = runeLayout();
    rune.open = true;
    io.to(room.id).emit('rune:flash', { flash, target: rune.target, layout: rune.layout, limitMs: RUNE_FLASH_MS });
    if (room.solo) laterInRound(room, between(RUNE_CPU_MIN_MS, RUNE_CPU_MAX_MS), () => { if (rune.flash === flash && rune.open) resolveRuneFlash(io, room, CPU, null); });
    laterInRound(room, RUNE_FLASH_MS, () => { if (rune.flash === flash && rune.open) resolveRuneFlash(io, room, null, null); });
  });
}

/**
 * A flash is caught (`side` = the catcher's team, or the computer wizard) or missed (null). Shows the result,
 * then the next flash or the round result. ponytail: the first tap to reach the server wins, so a slow network costs a bit.
 */
function resolveRuneFlash(io: Server, room: Room, side: RpsSide | null, by: Player | null) {
  const rune = room.rune;
  if (!rune.open) return;
  rune.open = false;
  if (side) rune.wins.set(side, (rune.wins.get(side) ?? 0) + 1);
  const players = Array.from(room.players.values());
  const sides: RpsSide[] = room.solo ? [...players.map((p) => p.color), CPU] : TEAMS;
  const wins = Object.fromEntries(sides.map((s) => [s, rune.wins.get(s) ?? 0]));
  const result: RuneResult = { flash: rune.flash, target: rune.target, winner: side, by: by?.name ?? (side === CPU ? 'Computer wizard' : null), wins };
  io.to(room.id).emit('rune:result', result);
  const roundWinner = runeRoundWinner(wins, rune.flash);
  laterInRound(room, RUNE_SHOW_MS, () => {
    if (roundWinner === undefined) return startRuneFlash(io, room);
    const player = roundWinner && roundWinner !== CPU ? players.find((p) => p.color === roundWinner) ?? null : null;
    if (!player) return endBattle(io, room, null, { timedOut: true });
    recordWinTime(room, player, Date.now() - room.spellRevealedAt!);
    endBattle(io, room, player, room.solo ? {} : { teamWin: true });
  });
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
    case 'memorize': {
      emit({ mode: 'memorize', latin, masked: maskSpell(latin), english, category, revealedAt, memorizeMs: MEMORIZE_SHOW_MS });
      laterInRound(room, MEMORIZE_SHOW_MS, () => io.to(room.id).emit('spell:hide', { limitMs: MEMORIZE_LIMIT_MS }));
      laterInRound(room, MEMORIZE_SHOW_MS + MEMORIZE_LIMIT_MS, () => endMemorizeOnLetters(io, room));
      return;
    }
    case 'puzzle': {
      room.puzzleImage = randomPuzzleImage(room.puzzleImage);
      emit({ mode: 'puzzle', image: room.puzzleImage, ...PUZZLE, order: scramblePuzzle(), revealedAt, limitMs: PUZZLE_LIMIT_MS });
      drawAfter(io, room, PUZZLE_LIMIT_MS);
      return;
    }
    case 'math': {
      const question = mathQuestion();
      room.math = { questions: [question], progress: new Map() };
      emit({ mode: 'math', question, revealedAt, limitMs: MATH_LIMIT_MS });
      laterInRound(room, MATH_LIMIT_MS, () => endMathOnAnswers(io, room));
      return;
    }
    case 'potion': {
      const progress = new Map(Array.from(room.players.keys()).map((id) => [id, { pos: 0, best: 0, done: false, out: false }]));
      room.potion = { sequence: potionSequence(), level: 0, open: false, progress };
      emit({ mode: 'potion', maxLevel: POTION_MAX_LEVEL, revealedAt });
      startPotionLevel(io, room);
      return;
    }
    case 'rune': {
      room.rune = { flash: 0, target: 0, layout: [], open: false, out: new Set(), wins: new Map() };
      emit({ mode: 'rune', winsNeeded: RUNE_WINS_NEEDED, flashes: RUNE_FLASHES, revealedAt });
      startRuneFlash(io, room);
      return;
    }
    case 'rps': {
      room.rps = { throw: 0, open: false, picks: new Map(), wins: new Map(), idleThrows: 0 };
      emit({ mode: 'rps', winsNeeded: RPS_WINS_NEEDED, revealedAt });
      startRpsThrow(io, room);
      return;
    }
    default:
      emit({ mode: 'type', spell, revealedAt });
      drawAfter(io, room, TYPE_LIMIT_MS);
  }
}

function startBattle(io: Server, room: Room) {
  if (room.state !== 'waiting' || (room.solo ? room.players.size < 1 : !bothTeamsPresent(room.players.values()))) return;

  room.round++;
  room.state = 'countdown';
  room.startedAt = Date.now();
  room.mode = randomMode(room.modesUsed, room.mode);
  // Every mode has been played: start a new cycle with this one.
  if (room.modesUsed.length >= MODES.length) room.modesUsed = [];
  room.modesUsed.push(room.mode);
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

    // Main screen "Exit room": closes the room for everyone. Phones get room:closed and go to the start page.
    socket.on('room:close', (payload: { roomId: string }, cb?: (result: { success: boolean; error?: string }) => void) => {
      const room = getRoom(payload?.roomId);
      if (!room || socket.data.role !== 'host' || socket.data.roomId !== room.id) {
        if (cb) cb({ success: false, error: 'Only the main screen of this room can close it' });
        return;
      }
      closeRoom(io, room, socket);
      socket.data.roomId = undefined;
      socket.data.role = undefined;
      console.log(`[room ${room.id}] closed by the main screen`);
      if (cb) cb({ success: true });
    });

    socket.on('room:join', (payload: { roomId: string; name?: string; color?: PlayerColor }, cb?: (result: { success: boolean; color?: PlayerColor; error?: string; notFound?: boolean }) => void) => {
      const room = getRoom(payload.roomId);
      if (!room) {
        if (cb) cb({ success: false, error: 'Room not found', notFound: true });
        return;
      }
      if (room.solo) {
        if (cb) cb({ success: false, error: "This room is in training mode. Try again when it's free." });
        return;
      }
      if (room.state === 'countdown' || room.state === 'playing') {
        if (cb) cb({ success: false, error: 'Battle already started' });
        return;
      }
      // Between rounds of an unfinished game nobody can join; after a finished game a new one starts.
      if (room.state === 'ended' && !isGameOver(room.roundResults, false)) {
        if (cb) cb({ success: false, error: 'A game is in progress. Try again when it ends.' });
        return;
      }
      const color = room.players.size < room.maxPlayers ? pickTeam(room.players.values(), payload.color) : null;
      if (!color) {
        if (cb) cb({ success: false, error: `Room is full (max ${room.maxPlayers} wizards)` });
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
        newGame(room);
        resetRoom(room);
        io.to(room.id).emit('room:update', roomToPayload(room));
      }

    });

    // Waiting room: a wizard who hasn't pressed Let's Fight can move to the other team, if it has room.
    socket.on('player:team', (payload: { roomId: string; color: PlayerColor }, cb?: (result: { success: boolean; error?: string }) => void) => {
      const room = getRoom(payload?.roomId);
      const player = room?.players.get(socket.id);
      if (!room || !player || room.state !== 'waiting' || room.solo || player.fightReady) {
        if (cb) cb({ success: false, error: "You can change team until you press Let's Fight" });
        return;
      }
      if (!TEAMS.includes(payload.color)) {
        if (cb) cb({ success: false, error: 'Unknown team' });
        return;
      }
      if (payload.color !== player.color && teamSizes(room.players.values())[payload.color] >= MAX_TEAM_SIZE) {
        if (cb) cb({ success: false, error: `That team is full (max ${MAX_TEAM_SIZE} wizards)` });
        return;
      }
      player.color = payload.color;
      io.to(room.id).emit('room:update', roomToPayload(room));
      console.log(`[room ${room.id}] ${player.name} switched to ${player.color}`);
      if (cb) cb({ success: true });
      startWhenAllReady(io, room);
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

      startWhenAllReady(io, room);
      if (cb) cb({ success: true });
    });

    socket.on('spell:submit', (payload: { roomId: string; text: string }) => {
      const room = getRoom(payload.roomId);
      if (!room || room.state !== 'playing' || !room.spellRevealedAt) return;
      const player = room.players.get(socket.id);
      if (!player || room.submissions.has(socket.id) || room.lockedOut.has(socket.id)) return;

      // MathIsMagic: text is "<question index>:<picked number>". Every pick moves this player to the next question.
      if (room.mode === 'math') {
        const { questions, progress } = room.math;
        const me = progress.get(socket.id) ?? { index: 0, right: 0 };
        const [index, picked] = String(payload.text).split(':').map(Number);
        if (index !== me.index) return; // a double tap on a question already answered
        const q = questions[me.index];
        const lastCorrect = picked === q.a * q.b;
        if (lastCorrect) me.right++;
        me.index++;
        progress.set(socket.id, me);
        // Both players get the same questions in the same order; whoever gets further first adds the next one.
        if (!questions[me.index]) questions.push(mathQuestion());
        const next: MathNext = { question: questions[me.index], right: me.right, lastCorrect };
        io.to(socket.id).emit('math:next', next);
        return;
      }

      // Potion Mixing: text is "<level>:<ingredient>", one tap at a time. A wrong ingredient puts you out.
      if (room.mode === 'potion') {
        const potion = room.potion;
        const me = potion.progress.get(socket.id);
        const [level, ingredient] = String(payload.text).split(':').map(Number);
        if (!potion.open || level !== potion.level || !me || me.done || me.out) return;
        if (ingredient === potion.sequence[me.pos]) {
          me.pos++;
          if (me.pos === potionLength(level)) { me.done = true; me.best = level; }
        } else {
          me.out = true;
        }
        io.to(room.id).emit('potion:status', potionStatus(room));
        if (potionLevelFinished(room)) closePotionLevel(io, room);
        return;
      }

      // Rune Reflex: text is "<flash>:<rune>". The first right tap catches the flash for the team; a wrong tap is out for this flash.
      if (room.mode === 'rune') {
        const rune = room.rune;
        const [flash, tapped] = String(payload.text).split(':').map(Number);
        if (!rune.open || flash !== rune.flash || rune.out.has(socket.id)) return;
        if (tapped === rune.target) return resolveRuneFlash(io, room, player.color, player);
        rune.out.add(socket.id);
        io.to(socket.id).emit('rune:wrong', { flash });
        if (everyone(room, rune.out)) resolveRuneFlash(io, room, null, null);
        return;
      }

      // Rock Paper Scissors: one pick per throw; the throw resolves once every player picked.
      if (room.mode === 'rps') {
        if (!room.rps.open || room.rps.picks.has(socket.id) || !isRpsHand(payload.text)) return;
        room.rps.picks.set(socket.id, payload.text);
        if (everyone(room, room.rps.picks)) resolveRpsThrow(io, room);
        return;
      }

      const submittedAt = Date.now();
      const durationMs = submittedAt - room.spellRevealedAt;
      // Memorize: the spell is still on screen, so typing it now doesn't count.
      if (room.mode === 'memorize' && durationMs < MEMORIZE_SHOW_MS) return;

      // Memorize: correct words are filled in for this player only; they win once every word is found.
      const byWords = room.mode === 'memorize';
      if (byWords) {
        const latin = room.spell.latin;
        const before = room.foundWords.get(socket.id) ?? [];
        const found = matchWords(latin, String(payload.text), before);
        room.foundWords.set(socket.id, found);
        const total = spellWordCount(latin);
        if (found.length < total) {
          if (found.length > before.length) {
            const spellWords = latin.trim().split(/\s+/);
            const words = Object.fromEntries(found.map((i) => [i, spellWords[i]]));
            io.to(socket.id).emit('spell:progress', { words, found: found.length, total });
          } else {
            io.to(socket.id).emit('spell:submitted', { correct: false, durationMs, lockedOut: false });
          }
          return;
        }
      }

      const isChoice = room.mode === 'translate' || room.mode === 'describe';
      // Puzzle: the phone sends its final tile order ("0,1,2,…") once the picture is complete.
      // ponytail: the server trusts the phone's arrangement; replaying swaps would not stop a determined cheater either.
      const correct = byWords
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
        if (isChoice && everyone(room, room.lockedOut)) endBattle(io, room, null, { allWrong: true });
        return;
      }

      const submission = { socketId: socket.id, text: payload.text, submittedAt, spellRevealedAt: room.spellRevealedAt, durationMs, correct, valid: true };
      room.submissions.set(socket.id, submission);
      console.log(`[room ${room.id}] ${player.color} correct: duration=${durationMs}ms`);
      io.to(socket.id).emit('spell:submitted', { correct: true, durationMs });

      // Only Speed Cast waits for the others; every other mode ends on the first correct answer.
      if (room.mode !== 'type') return endBattle(io, room, player);

      if (everyone(room, room.submissions)) return endSpeedCast(io, room);

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
      const gameOver = isGameOver(room.roundResults, room.solo);
      console.log(`[room ${room.id}] ${player.color} pressed ${gameOver ? 'Fight/Train again' : 'Next round'}`);

      if (Array.from(room.players.values()).every((p) => p.rematchReady)) {
        continueWhenAllReady(io, room);
      } else {
        io.to(room.id).emit('room:update', roomToPayload(room));
        const waitingFor = Array.from(room.players.values()).filter((p) => !p.rematchReady);
        io.to(room.id).emit('rematch:waiting', { waitingFor: waitingFor.map((p) => p.color) });
        console.log(`[room ${room.id}] waiting for rematch: ${waitingFor.map((p) => p.color).join(', ')}`);
      }

      if (cb) cb({ success: true });
    });

    // Train alone (start page → /play/:room?train=1): the only player in a waiting room starts training; the room closes to others.
    socket.on('player:solo', (payload: { roomId: string }, cb?: (result: { success: boolean; error?: string }) => void) => {
      const room = getRoom(payload.roomId);
      const player = room?.players.get(socket.id);
      if (!room || !player || room.state !== 'waiting' || room.players.size !== 1) {
        if (cb) cb({ success: false, error: 'You can only start alone while you are the only wizard waiting' });
        return;
      }
      room.solo = true;
      newGame(room);
      player.fightReady = true;
      io.to(room.id).emit('room:update', roomToPayload(room));
      console.log(`[room ${room.id}] ${player.color} started training — countdown in 2s`);
      setTimeout(() => {
        const r = getRoom(room.id);
        if (r && r.solo && r.state === 'waiting') startBattle(io, r);
      }, 2000);
      if (cb) cb({ success: true });
    });

    // "Quit training": saves the session to the fight history and deletes the room. Allowed at any time.
    socket.on('player:solo:stop', (payload: { roomId: string }, cb?: (result: { success: boolean; error?: string }) => void) => {
      const room = getRoom(payload?.roomId);
      const player = room?.players.get(socket.id);
      if (!room || !room.solo || !player) {
        if (cb) cb({ success: false, error: 'No training to quit right now' });
        return;
      }
      socket.data.roomId = undefined;
      socket.data.role = undefined;
      endTraining(io, room, player, socket);
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
