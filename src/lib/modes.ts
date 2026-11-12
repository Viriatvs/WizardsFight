// Pure helpers for battle modes. Shared by server and client: no Node or browser APIs here.
import type { BattleMode, SpellData } from '@/types/game';

export const MODES: BattleMode[] = ['type', 'translate', 'describe', 'hangman', 'memorize', 'puzzle'];

export const MODE_LABELS: Record<BattleMode, string> = {
  type: 'Speed Cast',
  translate: 'Translate',
  describe: 'Describe',
  hangman: 'Hangman',
  memorize: 'Memorize',
  puzzle: 'Puzzle',
};

/** Puzzle mode: 600x800 crop of red-wizard_ready.png, cut into 3 x 4 = 12 tiles. */
export const PUZZLE = { image: '/images/puzzle-red-wizard.webp', cols: 3, rows: 4 } as const;
const PUZZLE_TILES = PUZZLE.cols * PUZZLE.rows;

export const CHOICE_COUNT = 4;

type Rand = () => number;

/** Random mode, never the same as the previous round's. */
export function randomMode(previous: BattleMode | null, rand: Rand = Math.random): BattleMode {
  const available = MODES.filter((m) => m !== previous);
  return available[Math.floor(rand() * available.length)];
}

function shuffle<T>(items: T[], rand: Rand): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The correct answer plus up to 3 different answers taken from other spells, shuffled. */
export function buildChoices(spell: SpellData, pool: SpellData[], field: 'english' | 'description', rand: Rand = Math.random): string[] {
  const correct = spell[field];
  const others = [...new Set(pool.map((s) => s[field]))].filter((v) => v !== correct);
  return shuffle([correct, ...shuffle(others, rand).slice(0, CHOICE_COUNT - 1)], rand);
}

/**
 * Puzzle: order[slot] = which tile is shown in that slot. Solved when order[i] === i.
 * The scramble is never already solved.
 */
export function scramblePuzzle(rand: Rand = Math.random, tiles: number = PUZZLE_TILES): number[] {
  const solved = Array.from({ length: tiles }, (_, i) => i);
  let order = shuffle(solved, rand);
  while (isSolved(order)) order = shuffle(solved, rand);
  return order;
}

export function isSolved(order: number[], tiles: number = PUZZLE_TILES): boolean {
  return order.length === tiles && order.every((tile, slot) => tile === slot);
}

/** Every letter becomes "_"; spaces stay so word lengths are visible. */
export function maskSpell(latin: string): string {
  return latin.replace(/\S/g, '_');
}

/** Hangman start: every word's first letter visible, the rest hidden. */
export function hangmanStart(latin: string): string {
  return latin.replace(/\S+/g, (word) => word[0] + '_'.repeat(word.length - 1));
}

/** Hangman step: the leftmost word whose last letter is still hidden gets it; once all are shown, a random letter. */
export function hangmanNextLetter(latin: string, masked: string, rand: Rand = Math.random): string {
  for (const m of latin.matchAll(/\S+/g)) {
    const last = m.index! + m[0].length - 1;
    if (masked[last] === '_') return masked.slice(0, last) + latin[last] + masked.slice(last + 1);
  }
  return revealRandomLetter(latin, masked, rand);
}

const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Memorize: indices of spell words the player has found, after adding `guess`.
 * A word counts wherever it is in the spell (any position), ignoring case; repeated words are all found.
 */
export function matchWords(latin: string, guess: string, found: number[] = []): number[] {
  const guessed = new Set(words(guess));
  const next = new Set(found);
  words(latin).forEach((w, i) => { if (guessed.has(w)) next.add(i); });
  return [...next].sort((a, b) => a - b);
}

/**
 * Fills a player's found words (index → word) into a masked spell. Used by Hangman (on top of the
 * shared revealed letters) and Memorize (on top of all underscores).
 */
export function fillWords(masked: string, found: Record<number, string> = {}): string {
  return masked.split(' ').map((w, i) => found[i] ?? w).join(' ');
}

/** Memorize: how many letters the found words add up to (the tie-breaker at the time limit). */
export function lettersFound(latin: string, found: number[]): number {
  const all = latin.trim().split(/\s+/);
  return found.reduce((sum, i) => sum + (all[i]?.length ?? 0), 0);
}

export function spellWordCount(latin: string): number {
  return words(latin).length;
}

/** Uncovers one random hidden position of `masked`. Returns it unchanged when nothing is hidden. */
export function revealRandomLetter(latin: string, masked: string, rand: Rand = Math.random): string {
  const hidden = [...masked].flatMap((c, i) => (c === '_' ? [i] : []));
  if (hidden.length === 0) return masked;
  const i = hidden[Math.floor(rand() * hidden.length)];
  return masked.slice(0, i) + latin[i] + masked.slice(i + 1);
}
