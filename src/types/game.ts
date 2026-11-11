export type RoomState = 'waiting' | 'countdown' | 'playing' | 'ended';
export type PlayerColor = 'blue' | 'red';
export type BattleMode = 'type' | 'translate' | 'describe' | 'hangman' | 'memorize';

/**
 * What the phones receive when a round starts. Each mode only gets what it must show,
 * so the answer never reaches a phone early (except memorize, which shows it for a few seconds).
 * limitMs: time left until the round ends in a draw, when known.
 */
export type SpellReveal =
  | { mode: 'type'; spell: SpellData; revealedAt: number }
  | { mode: 'translate' | 'describe'; latin: string; category: string; options: string[]; revealedAt: number; limitMs: number }
  | { mode: 'hangman'; masked: string; english: string; category: string; revealedAt: number }
  | { mode: 'memorize'; latin: string; masked: string; english: string; category: string; revealedAt: number; memorizeMs: number };

export interface Player {
  socketId: string;
  color: PlayerColor;
  name: string;
  joinedAt: number;
  wins: number;
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
