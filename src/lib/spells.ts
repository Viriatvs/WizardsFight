// Server-only: reads spells.md from disk. Imported by server.ts, never by client components.
import fs from 'fs';
import path from 'path';
import type { SpellData } from '@/types/game';

export type Spell = SpellData;

const SPELLS_FILE = path.join(process.cwd(), 'spells.md');
const LATIN_PATTERN = /^[\p{L} ]+$/u;

export function parseSpells(markdown: string): Spell[] {
  const spells: Spell[] = [];
  let category = '';
  markdown.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('## ')) category = line.slice(3).trim();
    if (!line.startsWith('|')) return;
    const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells[0] === 'Latin' || /^:?-+:?$/.test(cells[0])) return; // header / separator row
    const [latin, english, description] = cells;
    const where = `spells.md line ${i + 1}`;
    if (cells.length !== 3 || !latin || !english || !description) throw new Error(`${where}: expected | Latin | English | Description |`);
    if (!LATIN_PATTERN.test(latin)) throw new Error(`${where}: Latin "${latin}" may contain only letters and spaces`);
    if (!category) throw new Error(`${where}: spell is not under a ## category heading`);
    spells.push({ latin, english, description, category });
  });
  if (spells.length < 2) throw new Error('spells.md must contain at least 2 spells');
  return spells;
}

export const SPELLS = parseSpells(fs.readFileSync(SPELLS_FILE, 'utf8'));

export function randomSpell(excludeLatin?: string): Spell {
  const available = excludeLatin ? SPELLS.filter((s) => s.latin !== excludeLatin) : SPELLS;
  return available[Math.floor(Math.random() * available.length)];
}
