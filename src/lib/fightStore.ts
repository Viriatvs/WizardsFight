// Server-only: fight history saved in a JSON file (uses fs; never import from client components).
// ponytail: a JSON file on the server; on Render's free plan it's wiped on redeploy/restart. Move to a database to keep history for good.
import fs from 'fs';
import path from 'path';
import type { FightRecord } from '@/lib/fights';

export const FIGHTS_FILE = path.join(process.cwd(), 'data', 'fights.json');
/** Oldest fights beyond this are dropped so the file stays small. */
export const MAX_FIGHTS = 1000;

/** All saved fights, newest first. A missing file means no fights yet; a broken file is set aside, not lost. */
export function readFights(file: string = FIGHTS_FILE): FightRecord[] {
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error(`[fights] could not read ${file}`, err);
    return [];
  }
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    const backup = `${file}.corrupt-${Date.now()}`;
    console.error(`[fights] ${file} is not valid JSON; moved it to ${backup}`, err);
    try { fs.renameSync(file, backup); } catch { /* keep going with an empty history */ }
    return [];
  }
}

/** Adds a fight at the top and saves. Written to a temp file first, then renamed, so a crash can't leave half a file. */
export function saveFight(fight: FightRecord, file: string = FIGHTS_FILE): void {
  try {
    const fights = [fight, ...readFights(file)].slice(0, MAX_FIGHTS);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(fights, null, 1));
    fs.renameSync(tmp, file);
  } catch (err) {
    // Losing a history entry must never break the game itself.
    console.error('[fights] could not save fight', err);
  }
}
