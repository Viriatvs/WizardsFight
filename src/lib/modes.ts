// Pure helpers for battle modes. Shared by server and client: no Node or browser APIs here.
import type { BattleMode, MathQuestion, RpsHand, SpellData } from '@/types/game';

export const MODES: BattleMode[] = ['type', 'translate', 'describe', 'memorize', 'puzzle', 'rps', 'math'];

export const MODE_LABELS: Record<BattleMode, string> = {
  type: 'Speed Cast',
  translate: 'Translate',
  describe: 'Describe',
  memorize: 'Memorize',
  puzzle: 'Puzzle',
  rps: 'Rock Paper Scissors',
  math: 'Math Is Magic',
};

/** Puzzle mode: a 3 x 4 = 12-tile grid. */
export const PUZZLE = { cols: 3, rows: 4 } as const;
const PUZZLE_TILES = PUZZLE.cols * PUZZLE.rows;

/** Puzzle pictures: all 600x800 (3:4) pixel art in public/images. To add one, drop it there and list it here. */
export const PUZZLE_IMAGES = [
  '/images/puzzle-red-wizard.webp',
  '/images/puzzle-blue-wizard.webp',
  '/images/puzzle-blue-wizard_burn.webp',
  '/images/puzzle-red-wizard_electro.webp',
] as const;

/** Random puzzle picture, never the same as the previous one when there is a choice. */
export function randomPuzzleImage(previous: string | null, rand: Rand = Math.random): string {
  const available = PUZZLE_IMAGES.filter((img) => img !== previous);
  return available[Math.floor(rand() * available.length)];
}

export const CHOICE_COUNT = 4;

type Rand = () => number;

/**
 * Random mode not yet `used` in this battle. Once every mode was used, any mode may come again.
 * Never the same as the previous round's.
 */
export function randomMode(used: BattleMode[], previous: BattleMode | null, rand: Rand = Math.random): BattleMode {
  const fresh = MODES.filter((m) => !used.includes(m) && m !== previous);
  const available = fresh.length ? fresh : MODES.filter((m) => m !== previous);
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

/** Memorize: fills a player's found words (index → word) into the masked spell. */
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

export const RPS_HANDS: RpsHand[] = ['rock', 'paper', 'scissors'];
const RPS_BEATS: Record<RpsHand, RpsHand> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export const isRpsHand = (text: unknown): text is RpsHand => RPS_HANDS.includes(text as RpsHand);

export const randomRpsHand = (rand: Rand = Math.random): RpsHand => RPS_HANDS[Math.floor(rand() * RPS_HANDS.length)];

/** One throw: 'a' or 'b' wins, or null for a tie. No pick (null) loses to any pick; two missing picks tie. */
export function rpsThrowWinner(a: RpsHand | null, b: RpsHand | null): 'a' | 'b' | null {
  if (a === b) return null;
  if (!b || (a && RPS_BEATS[a] === b)) return 'a';
  return 'b';
}

/** MathIsMagic: both factors are drawn from this range (inclusive). Change it to make the sums easier or harder. */
export const MATH_FACTOR = { min: 2, max: 9 } as const;
/** MathIsMagic in training: right answers needed in the time limit to pass the round. */
export const MATH_TRAINING_TARGET = 5;

/** One multiplication with CHOICE_COUNT options (the product plus wrong ones), shuffled. */
export function mathQuestion(rand: Rand = Math.random): MathQuestion {
  const factor = () => MATH_FACTOR.min + Math.floor(rand() * (MATH_FACTOR.max - MATH_FACTOR.min + 1));
  const a = factor();
  const b = factor();
  const answer = a * b;
  // Wrong options are near misses: a neighbouring times-table result, or the product off by 1 or 10.
  const nearMisses = [(a - 1) * b, (a + 1) * b, a * (b - 1), a * (b + 1), answer - 1, answer + 1, answer - 10, answer + 10];
  const candidates = [...new Set(nearMisses)].filter((n) => n > 0 && n !== answer);
  const wrong = shuffle(candidates, rand).slice(0, CHOICE_COUNT - 1);
  return { a, b, options: shuffle([answer, ...wrong], rand) };
}
