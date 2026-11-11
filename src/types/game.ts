export type RoomState = 'waiting' | 'countdown' | 'playing' | 'ended';
export type PlayerColor = 'blue' | 'red';
export type BattleMode = 'type' | 'translate' | 'describe' | 'hangman' | 'memorize' | 'puzzle';

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
  /** Game winner once the game is over, otherwise null. */
  winner: PlayerColor | null;
}

/** battle:end payload: one round's result plus the game state after it. */
export interface BattleEnd {
  winnerColor: PlayerColor | null;
  winnerName: string | null;
  durationMs: number | null;
  /** Per player (keyed by socket id). Also the source of both names for the score table. */
  results: Record<string, { color: PlayerColor; name: string; durationMs: number; correct: boolean }>;
  game: GameInfo;
  /** Mode of the round that ended (for mode-specific draw messages). */
  mode: BattleMode | null;
  timedOut?: boolean;
  graceTimeout?: boolean;
  allWrong?: boolean;
  forfeit?: boolean;
}

/**
 * What the phones receive when a round starts. Each mode only gets what it must show,
 * so the answer never reaches a phone early (except memorize, which shows it for a few seconds).
 * limitMs: time left until the round ends in a draw, when known.
 */
export type SpellReveal =
  | { mode: 'type'; spell: SpellData; revealedAt: number }
  | { mode: 'translate' | 'describe'; latin: string; category: string; options: string[]; revealedAt: number; limitMs: number }
  | { mode: 'hangman'; masked: string; english: string; category: string; revealedAt: number }
  | { mode: 'memorize'; latin: string; masked: string; english: string; category: string; revealedAt: number; memorizeMs: number }
  /** order[slot] = tile shown in that slot; both players get the same order. */
  | { mode: 'puzzle'; image: string; cols: number; rows: number; order: number[]; revealedAt: number; limitMs: number };

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
  /** Results of the current game's finished rounds. Cleared when a new game starts or is cancelled. */
  roundResults: RoundResults;
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
