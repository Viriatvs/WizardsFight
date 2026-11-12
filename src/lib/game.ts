// Game rules: a game is a series of rounds. Pure and shared by server and client.
import type { PlayerColor, RoundResults, GameScore, BattleEnd } from '@/types/game';

export type { RoundResults, GameScore };

export const BASE_ROUNDS = 3;
export const WINS_NEEDED = 2;

export function gameScore(results: RoundResults): GameScore {
  const score: GameScore = { blue: 0, red: 0, draws: 0 };
  for (const r of results) {
    if (r) score[r]++;
    else score.draws++;
  }
  return score;
}

/**
 * Best of 3: first to 2 round wins. If 3 rounds are played without that and the score is level,
 * extra rounds are played until someone is ahead. Returns the game winner, or null while the game goes on.
 */
export function gameWinner(results: RoundResults): PlayerColor | null {
  const { blue, red } = gameScore(results);
  if (blue >= WINS_NEEDED) return 'blue';
  if (red >= WINS_NEEDED) return 'red';
  if (results.length >= BASE_ROUNDS && blue !== red) return blue > red ? 'blue' : 'red';
  return null;
}

/** Training alone is always this many rounds. */
export const TRAINING_ROUNDS = 5;

/** A versus game is over once it has a winner; a training session after TRAINING_ROUNDS rounds. */
export function isGameOver(results: RoundResults, training: boolean): boolean {
  return training ? results.length >= TRAINING_ROUNDS : gameWinner(results) !== null;
}

/** Training summary: rounds played, solved, failed and the best (lowest) solved time. */
export function trainingSummary(results: RoundResults, times: Array<number | null>) {
  const solvedTimes = times.filter((t, i): t is number => results[i] !== null && t !== null);
  const solved = results.filter((r) => r !== null).length;
  return { played: results.length, solved, failed: results.length - solved, best: solvedTimes.length ? Math.min(...solvedTimes) : null };
}

/** Label for a round number (1-based), e.g. "Round 2", "Round 4 · Extra round" or "Training · Round 2 of 5". */
export function roundLabel(round: number, training = false): string {
  if (training) return `Training · Round ${round} of ${TRAINING_ROUNDS}`;
  return round > BASE_ROUNDS ? `Round ${round} · Extra round` : `Round ${round}`;
}

/** "1.84 s" */
export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Why a round ended without a winner, for the result screens. */
export function drawReason(end: Pick<BattleEnd, 'allWrong' | 'mode' | 'results'> & { game?: { training: boolean } }): string {
  if (end.game?.training) {
    if (end.allWrong) return 'Wrong answer';
    if (end.mode === 'puzzle') return 'Puzzle not finished in time';
    if (end.mode === 'memorize' || end.mode === 'hangman') return 'Spell not completed in time';
    return 'Time ran out';
  }
  if (end.allWrong) return 'Both wizards chose wrong';
  if (end.mode === 'puzzle') return 'Nobody finished the puzzle in time';
  if (end.mode === 'memorize') {
    const letters = Object.values(end.results).map((r) => r.letters ?? 0);
    return letters.some((l) => l > 0) ? `Same number of correct letters (${letters[0]})` : 'Nobody remembered a word';
  }
  return 'No valid spell cast in time';
}

/** Extra line for a win that wasn't a completed answer, e.g. "Won on letters: 12 vs 9". */
export function winDetail(end: Pick<BattleEnd, 'onLetters' | 'winnerColor' | 'results'>): string | null {
  if (!end.onLetters || !end.winnerColor) return null;
  const results = Object.values(end.results);
  const mine = results.find((r) => r.color === end.winnerColor)?.letters ?? 0;
  const theirs = results.find((r) => r.color !== end.winnerColor)?.letters ?? 0;
  return `Won on letters: ${mine} vs ${theirs}`;
}
