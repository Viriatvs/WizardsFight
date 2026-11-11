// Pure helpers for battle modes. Shared by server and client: no Node or browser APIs here.
import type { BattleMode, SpellData } from '@/types/game';

export const MODES: BattleMode[] = ['type', 'translate', 'describe', 'hangman', 'memorize'];

export const MODE_LABELS: Record<BattleMode, string> = {
  type: 'Speed Cast',
  translate: 'Translate',
  describe: 'Describe',
  hangman: 'Hangman',
  memorize: 'Memorize',
};

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

/** Every letter becomes "_"; spaces stay so word lengths are visible. */
export function maskSpell(latin: string): string {
  return latin.replace(/\S/g, '_');
}

/** Uncovers one random hidden position of `masked`. Returns it unchanged when nothing is hidden. */
export function revealRandomLetter(latin: string, masked: string, rand: Rand = Math.random): string {
  const hidden = [...masked].flatMap((c, i) => (c === '_' ? [i] : []));
  if (hidden.length === 0) return masked;
  const i = hidden[Math.floor(rand() * hidden.length)];
  return masked.slice(0, i) + latin[i] + masked.slice(i + 1);
}
