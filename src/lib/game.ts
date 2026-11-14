// Game rules: a game is a series of rounds. Pure and shared by server and client.
import { MATH_TRAINING_TARGET, POTION_TRAINING_TARGET } from './modes';
import { teamAverages, formatAverage } from './teams';
import type { PlayerColor, RoundResults, GameScore, BattleEnd } from '@/types/game';

export type { RoundResults, GameScore };

/** A versus game is always exactly this many rounds. */
export const GAME_ROUNDS = 3;

export function gameScore(results: RoundResults): GameScore {
  const score: GameScore = { blue: 0, red: 0, draws: 0 };
  for (const r of results) {
    if (r) score[r]++;
    else score.draws++;
  }
  return score;
}

/**
 * All 3 rounds are always played; then whoever won more rounds wins the game. Returns null while the game
 * goes on, and for a drawn game (level after 3 rounds).
 */
export function gameWinner(results: RoundResults): PlayerColor | null {
  if (results.length < GAME_ROUNDS) return null;
  const { blue, red } = gameScore(results);
  if (blue === red) return null;
  return blue > red ? 'blue' : 'red';
}

/** A versus game is over after 3 rounds, won or drawn. Training never is: it goes on until the wizard quits. */
export function isGameOver(results: RoundResults, training: boolean): boolean {
  return !training && results.length >= GAME_ROUNDS;
}

/** Training summary: rounds played, solved, failed and the best (lowest) solved time. */
export function trainingSummary(results: RoundResults, times: Array<number | null>) {
  const solvedTimes = times.filter((t, i): t is number => results[i] !== null && t !== null);
  const solved = results.filter((r) => r !== null).length;
  return { played: results.length, solved, failed: results.length - solved, best: solvedTimes.length ? Math.min(...solvedTimes) : null };
}

/** Label for a round number (1-based), e.g. "Round 2 of 3" or "Training · Round 2". */
export function roundLabel(round: number, training = false): string {
  return training ? `Training · Round ${round}` : `Round ${round} of ${GAME_ROUNDS}`;
}

/** "1.84 s" */
export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Why a round ended without a winner, for the result screens. */
export function drawReason(end: Pick<BattleEnd, 'allWrong' | 'mode' | 'results'> & { game?: { training: boolean } }): string {
  if (end.game?.training) {
    if (end.allWrong) return 'Wrong answer';
    if (end.mode === 'puzzle') return 'Puzzle not finished in time';
    if (end.mode === 'memorize') return 'Spell not completed in time';
    if (end.mode === 'rps') return 'The computer wizard won';
    if (end.mode === 'math') return `Fewer than ${MATH_TRAINING_TARGET} right answers`;
    if (end.mode === 'potion') return `Fewer than ${POTION_TRAINING_TARGET} potions brewed`;
    if (end.mode === 'rune') return 'The computer wizard was faster';
    return 'Time ran out';
  }
  if (end.allWrong) return 'Every wizard chose wrong';
  if (end.mode === 'puzzle') return 'Nobody finished the puzzle in time';
  if (end.mode === 'rps') return 'Nobody picked in time';
  if (end.mode === 'rune') return 'Same number of runes caught';
  const results = Object.values(end.results);
  if (end.mode === 'math') return `Same number of right answers (${formatAverage(teamAverages(results, (r) => r.rightAnswers ?? 0).blue)})`;
  if (end.mode === 'potion') {
    const level = teamAverages(results, (r) => r.potionLevel ?? 0).blue;
    return level > 0 ? `Same potion level (${formatAverage(level)})` : 'Nobody brewed a potion';
  }
  if (end.mode === 'memorize') {
    const letters = teamAverages(results, (r) => r.letters ?? 0).blue;
    return letters > 0 ? `Same number of correct letters (${formatAverage(letters)})` : 'Nobody remembered a word';
  }
  return 'No valid spell cast in time';
}

/** Extra line for a win that wasn't a completed answer, e.g. "Won on letters: 12 vs 9". */
export function winDetail(end: Pick<BattleEnd, 'onLetters' | 'winnerColor' | 'results'> & { mode?: BattleEnd['mode'] }): string | null {
  if (!end.winnerColor) return null;
  const results = Object.values(end.results);
  // Team averages (a one-wizard team's average is just that wizard's count).
  const versus = (value: (r: (typeof results)[number]) => number) => {
    const avg = teamAverages(results, value);
    const loser = end.winnerColor === 'blue' ? 'red' : 'blue';
    return `${formatAverage(avg[end.winnerColor!])} vs ${formatAverage(avg[loser])}`;
  };
  if (end.mode === 'math') {
    const solo = results.every((r) => r.color === end.winnerColor);
    return solo ? `${results[0]?.rightAnswers ?? 0} right answers` : `Right answers: ${versus((r) => r.rightAnswers ?? 0)}`;
  }
  if (end.mode === 'potion') {
    const solo = results.every((r) => r.color === end.winnerColor);
    return solo ? `${results[0]?.potionLevel ?? 0} potions brewed` : `Potion levels: ${versus((r) => r.potionLevel ?? 0)}`;
  }
  if (!end.onLetters) return null;
  return `Won on letters: ${versus((r) => r.letters ?? 0)}`;
}
