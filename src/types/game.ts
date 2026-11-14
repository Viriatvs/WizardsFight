export type RoomState = 'waiting' | 'countdown' | 'playing' | 'ended';
export type PlayerColor = 'blue' | 'red';
export type BattleMode = 'type' | 'translate' | 'describe' | 'memorize' | 'puzzle' | 'rps' | 'math' | 'potion' | 'rune' | 'cauldron';
export type RpsHand = 'rock' | 'paper' | 'scissors';
/** Rock Paper Scissors / Rune Reflex side: a player's color, or the computer wizard in training. */
export type RpsSide = PlayerColor | 'cpu';

/** One entry per finished round of the current game: the winner's color, or null for a draw. */
export type RoundResults = Array<PlayerColor | null>;

export interface GameScore {
  blue: number;
  red: number;
  draws: number;
}

/** Sent with room:update and battle:end so every screen can show the round and score. */
export interface GameInfo {
  /** Current round number (1-based): the one being played, or the one that just ended. */
  round: number;
  results: RoundResults;
  score: GameScore;
  /** Game winner once the game is over, otherwise null. Always null in training. */
  winner: PlayerColor | null;
  /** The game (or training session) is finished: show the final screen. */
  over: boolean;
  /** Training alone ("Start alone"): rounds solved or failed until the wizard quits; the room is closed to new players. */
  training: boolean;
  /** Per finished round: the winner's time in ms, or null (draw / failed). */
  times: Array<number | null>;
}

/** battle:end payload: one round's result plus the game state after it. */
export interface BattleEnd {
  winnerColor: PlayerColor | null;
  winnerName: string | null;
  durationMs: number | null;
  /** Per player (keyed by socket id). Also the source of both names for the score table. */
  results: Record<string, { color: PlayerColor; name: string; durationMs: number; correct: boolean; letters?: number; rightAnswers?: number; potionLevel?: number }>;
  game: GameInfo;
  /** Memorize: nobody completed the spell, the winner had more correct letters (see results[].letters). */
  onLetters?: boolean;
  /** Mode of the round that ended (for mode-specific draw messages). */
  mode: BattleMode | null;
  timedOut?: boolean;
  graceTimeout?: boolean;
  allWrong?: boolean;
  forfeit?: boolean;
  /** Won by the whole team (team average or team throws); winnerName is then the team's names. */
  teamWin?: boolean;
  /** Translate/describe: the correct option, sent only once the round is over. */
  answer?: string;
}

/**
 * What the phones receive when a round starts. Each mode only gets what it must show,
 * so the answer never reaches a phone early (except memorize, which shows it for a few seconds).
 * limitMs: time left until the round ends in a draw, when known.
 */
export type SpellReveal =
  | { mode: 'type'; spell: SpellData; revealedAt: number }
  | { mode: 'translate' | 'describe'; latin: string; category: string; options: string[]; revealedAt: number; limitMs: number }
  | { mode: 'memorize'; latin: string; masked: string; english: string; category: string; revealedAt: number; memorizeMs: number }
  /** order[slot] = tile shown in that slot; both players get the same order. */
  | { mode: 'puzzle'; image: string; cols: number; rows: number; order: number[]; revealedAt: number; limitMs: number }
  /** Throws follow as rps:throw / rps:result events. */
  | { mode: 'rps'; winsNeeded: number; revealedAt: number }
  /** The player's first question; the next ones arrive as math:next. */
  | { mode: 'math'; question: MathQuestion; revealedAt: number; limitMs: number }
  /** Levels follow as potion:show / potion:input / potion:status events. */
  | { mode: 'potion'; maxLevel: number; revealedAt: number }
  /** Flashes follow as rune:ready / rune:flash / rune:result events. */
  | { mode: 'rune'; winsNeeded: number; flashes: number; revealedAt: number }
  /** Waves follow as cauldron:wave / cauldron:ask / cauldron:answered / cauldron:result events. */
  | { mode: 'cauldron'; winsNeeded: number; waves: number; revealedAt: number };

/** MathIsMagic question: a × b, with the product among the options. The answer itself is never sent. */
export interface MathQuestion { a: number; b: number; options: number[] }

/** math:next (to one player): their next question, right answers so far, and whether the last pick was right. */
export interface MathNext { question: MathQuestion; right: number; lastCorrect: boolean }

/** rps:throw: a new throw starts; pick within limitMs. */
export interface RpsThrow { throw: number; limitMs: number }

/** rps:result: both hands of a throw (null = no pick in time), its winner (null = tie) and the throws won so far. */
export interface RpsResult {
  throw: number;
  hands: Partial<Record<RpsSide, RpsHand | null>>;
  winner: RpsSide | null;
  wins: Partial<Record<RpsSide, number>>;
}

/** potion:show: the ingredients to repeat this level (indices into the ingredient list), one every stepMs. */
export interface PotionShow { level: number; sequence: number[]; stepMs: number }
/** potion:input: brewing is open for limitMs. */
export interface PotionInput { level: number; limitMs: number }
/** potion:status: every wizard's state. best = levels completed; done = finished this level; out = wrong tap or too slow. */
export interface PotionStatus { level: number; players: Record<string, { color: PlayerColor; name: string; best: number; done: boolean; out: boolean }> }

/** rune:flash: tap `target` on the grid, laid out as `layout` (rune indices), within limitMs. */
export interface RuneFlash { flash: number; target: number; layout: number[]; limitMs: number }
/** rune:result: who caught the flash (null = nobody), by which wizard, and the flashes won so far. */
/** One creature crossing the sky: y and the timing are shared, so every screen shows the same flight. */
export interface Flyer { kind: 'bat' | 'ghost'; y: number; delayMs: number; durationMs: number; fromLeft: boolean }
/** cauldron:wave: the creatures of this wave; they all cross within flightMs. */
export interface CauldronWave { wave: number; flyers: Flyer[]; flightMs: number }
/** cauldron:ask: tap a count from 1 to max within limitMs. */
export interface CauldronAsk { wave: number; limitMs: number; max: number }
/** cauldron:result: the real count, every guess, the wave's winner (null = nobody; 'cpu' = a training miss) and waves won so far. */
export interface CauldronResult {
  wave: number;
  bats: number;
  guesses: Record<string, { name: string; color: PlayerColor; guess: number | null }>;
  winner: RpsSide | null;
  wins: Partial<Record<RpsSide, number>>;
}

export interface RuneResult { flash: number; target: number; winner: RpsSide | null; by: string | null; wins: Partial<Record<RpsSide, number>> }

export interface Player {
  socketId: string;
  color: PlayerColor;
  name: string;
  joinedAt: number;
  rematchReady: boolean;
  fightReady: boolean;
}

export interface Submission {
  socketId: string;
  text: string;
  submittedAt: number;
  spellRevealedAt: number;
  durationMs: number;
  correct: boolean;
  valid: boolean;
}

export interface Room {
  id: string;
  hostSocketId: string;
  players: Map<string, Player>;
  state: RoomState;
  spell: SpellData;
  startedAt: number | null;
  spellRevealedAt: number | null;
  submissions: Map<string, Submission>;
  maxPlayers: number;
  graceTimerStarted: boolean;
  firstCorrectAt: number | null;
  round: number;
  mode: BattleMode | null;
  /** Translate/describe: players who picked a wrong option this round. */
  lockedOut: Set<string>;
  /** Memorize: spell word indices each player has typed correctly this round (socketId → indices). */
  foundWords: Map<string, number[]>;
  /** Modes played in the current battle since the last time every mode had been used. */
  modesUsed: BattleMode[];
  /** Results of the current game's finished rounds. Cleared when a new game starts or is cancelled. */
  roundResults: RoundResults;
  /** Winner's time per finished round (null for a draw/failed round); parallel to roundResults. */
  roundTimes: Array<number | null>;
  /** Training alone: one player, as many rounds as they like, nobody else may join. Quitting deletes the room. */
  solo: boolean;
  /** Rock Paper Scissors: the current throw. `open` while picks are accepted; picks/wins keyed by socket id ('cpu' in training). */
  rps: { throw: number; open: boolean; picks: Map<string, RpsHand>; wins: Map<string, number>; idleThrows: number };
  /** MathIsMagic: the round's shared question list and each player's position in it and right answers (socketId →). */
  math: { questions: MathQuestion[]; progress: Map<string, { index: number; right: number }> };
  /** Potion Mixing: the shared ingredient sequence, the current level, whether taps count, and each wizard's progress. */
  potion: { sequence: number[]; level: number; open: boolean; progress: Map<string, { pos: number; best: number; done: boolean; out: boolean }> };
  /** Rune Reflex: the current flash (target + grid), whether taps count, who tapped wrong this flash, flashes won per side. */
  rune: { flash: number; target: number; layout: number[]; open: boolean; out: Set<string>; wins: Map<string, number> };
  /** Cauldron Count: the current wave's real bat count, whether answers count, each wizard's guess, waves won per side. */
  cauldron: { wave: number; bats: number; open: boolean; guesses: Map<string, number>; wins: Map<string, number> };
  /** Last puzzle picture used in this room, so the next Puzzle round shows a different one. */
  puzzleImage: string | null;
}

export interface SpellData {
  latin: string;
  english: string;
  description: string;
  category: string;
}

export interface BattleResult {
  winnerColor: PlayerColor | null;
  winnerName: string | null;
  durationMs: number | null;
  results: Map<string, {
    color: PlayerColor;
    name: string;
    durationMs: number;
    correct: boolean;
  }>;
}

export type GamePhase = 'connecting' | 'name' | 'waiting' | 'countdown' | 'spell' | 'result' | 'ended';
