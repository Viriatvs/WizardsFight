// Team rules: every wizard is on the Blue or the Red team. Pure and shared by server and client.
import type { PlayerColor } from '@/types/game';

export const TEAMS: PlayerColor[] = ['blue', 'red'];
export const MAX_TEAM_SIZE = 4;
export const MAX_PLAYERS = MAX_TEAM_SIZE * TEAMS.length;

export const otherTeam = (c: PlayerColor): PlayerColor => (c === 'blue' ? 'red' : 'blue');

type Member = { color: PlayerColor };

export function teamSizes(players: Iterable<Member>): Record<PlayerColor, number> {
  const sizes: Record<PlayerColor, number> = { blue: 0, red: 0 };
  for (const p of players) sizes[p.color]++;
  return sizes;
}

/** Team for a new wizard: the preferred one if it has room, else the smaller one (blue on a tie); null when the room is full. */
export function pickTeam(players: Iterable<Member>, preferred?: PlayerColor | null): PlayerColor | null {
  const sizes = teamSizes(players);
  if (preferred && sizes[preferred] < MAX_TEAM_SIZE) return preferred;
  const smaller: PlayerColor = sizes.red < sizes.blue ? 'red' : 'blue';
  return sizes[smaller] < MAX_TEAM_SIZE ? smaller : null;
}

/** A versus battle can start once each team has at least one wizard. */
export function bothTeamsPresent(players: Iterable<Member>): boolean {
  const sizes = teamSizes(players);
  return sizes.blue > 0 && sizes.red > 0;
}

/** "Merlin", "Merlin & Ana", "Merlin, Ana & Zed" */
export function joinNames(names: string[]): string {
  return names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** Team name per color: its members' names, in join order. */
export function teamNames(players: Iterable<Member & { name: string }>): Partial<Record<PlayerColor, string>> {
  const names: Partial<Record<PlayerColor, string[]>> = {};
  for (const p of players) (names[p.color] ??= []).push(p.name);
  return Object.fromEntries(Object.entries(names).map(([c, n]) => [c, joinNames(n)]));
}

/** Average of `value` per team (0 for a team with nobody). Used where a count at the time limit decides the round. */
export function teamAverages<T extends Member>(players: Iterable<T>, value: (p: T) => number): Record<PlayerColor, number> {
  const sum: Record<PlayerColor, number> = { blue: 0, red: 0 };
  const count: Record<PlayerColor, number> = { blue: 0, red: 0 };
  for (const p of players) {
    sum[p.color] += value(p);
    count[p.color]++;
  }
  return { blue: count.blue ? sum.blue / count.blue : 0, red: count.red ? sum.red / count.red : 0 };
}

/** The team with the higher average, or null on a tie. */
export function higherTeam(averages: Record<PlayerColor, number>): PlayerColor | null {
  if (averages.blue === averages.red) return null;
  return averages.blue > averages.red ? 'blue' : 'red';
}

/** "7", "6.5" — team averages are shown with at most one decimal. */
export const formatAverage = (n: number) => String(Math.round(n * 10) / 10);
