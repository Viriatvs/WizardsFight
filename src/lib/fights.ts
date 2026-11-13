// Fight history records and their wording. Pure: shared by server, pages and tests.
import type { PlayerColor } from '@/types/game';

/** One finished versus game (best of 3). */
export interface FightRecord {
  id: string;
  /** ISO timestamp of when the game ended. */
  at: string;
  winner: { name: string; color: PlayerColor };
  loser: { name: string; color: PlayerColor };
  /** Round wins: winner first. */
  score: { winner: number; loser: number };
  draws: number;
  /** Rounds played, draws included. */
  rounds: number;
}

/** How many recent fights the landing-page carousel cycles through. */
export const RECENT_FIGHTS = 10;

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  return `${day}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th'}`;
}

/**
 * "November 5th 2026". Formatted in UTC so the server-rendered history page and the
 * landing page always agree. ponytail: UTC date; switch to the viewer's time zone if late-night fights look off by a day.
 */
export function fightDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  return `${month} ${ordinal(d.getUTCDate())} ${d.getUTCFullYear()}`;
}

/** "Merlin won against Morgana with 5 rounds on November 5th 2026" */
export function fightSentence(f: FightRecord): string {
  return `${f.winner.name} won against ${f.loser.name} with ${f.rounds} round${f.rounds === 1 ? '' : 's'} on ${fightDate(f.at)}`;
}
