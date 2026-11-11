// Game rules: a game is a series of rounds. Pure and shared by server and client.
import type { PlayerColor, RoundResults, GameScore } from '@/types/game';

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

/** Label for a round number (1-based), e.g. "Round 2" or "Round 4 · Extra round". */
export function roundLabel(round: number): string {
  return round > BASE_ROUNDS ? `Round ${round} · Extra round` : `Round ${round}`;
}
