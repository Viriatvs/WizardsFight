// Fight history records and their wording. Pure: shared by server, pages and tests.
import type { PlayerColor } from '@/types/game';

/** One finished versus game (3 rounds). Older records have no `kind`. A drawn game has `draw` and lists blue as `winner`. */
export interface VersusRecord {
  kind?: 'versus';
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
  draw?: true;
}

/** One training session, saved when the wizard quits: rounds solved out of rounds played. */
export interface TrainingRecord {
  kind: 'training';
  id: string;
  at: string;
  player: { name: string; color: PlayerColor };
  solved: number;
  played: number;
}

export type FightRecord = VersusRecord | TrainingRecord;

export const isTraining = (f: FightRecord): f is TrainingRecord => f.kind === 'training';

/** The history only keeps the current day's fights (UTC, like fightDate). */
export function isSameDay(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
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

/** "Merlin won against Morgana with 3 rounds on November 5th 2026", "Merlin and Morgana drew 1–1 on …" or "Merlin won 7 out of 10 games in training on …" */
export function fightSentence(f: FightRecord): string {
  if (isTraining(f)) return `${f.player.name} won ${f.solved} out of ${f.played} game${f.played === 1 ? '' : 's'} in training on ${fightDate(f.at)}`;
  if (f.draw) return `${f.winner.name} and ${f.loser.name} drew ${f.score.winner}–${f.score.loser} on ${fightDate(f.at)}`;
  return `${f.winner.name} won against ${f.loser.name} with ${f.rounds} round${f.rounds === 1 ? '' : 's'} on ${fightDate(f.at)}`;
}
