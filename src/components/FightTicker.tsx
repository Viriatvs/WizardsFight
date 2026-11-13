'use client';

import { useEffect, useState } from 'react';
import { fightDate, type FightRecord } from '@/lib/fights';
import type { PlayerColor } from '@/types/game';

/** How long each duel stays on the line before the next one slides up. */
const SHOW_MS = 3500;
const SLIDE_MS = 500;

const NAME_COLOR: Record<PlayerColor, string> = { blue: 'text-blue-400', red: 'text-red-400' };

function FightLine({ fight }: { fight: FightRecord }) {
  return (
    <li className="h-6 leading-6 truncate">
      <span className={`font-pixel ${NAME_COLOR[fight.winner.color]}`}>{fight.winner.name}</span>
      {' won against '}
      <span className={`font-pixel ${NAME_COLOR[fight.loser.color]}`}>{fight.loser.name}</span>
      {` with ${fight.rounds} round${fight.rounds === 1 ? '' : 's'} on ${fightDate(fight.at)}`}
    </li>
  );
}

/** Landing page: the latest duels on a single line, each sliding up to make room for the next. */
export default function FightTicker() {
  const [fights, setFights] = useState<FightRecord[] | null>(null);
  const [index, setIndex] = useState(0);
  const [sliding, setSliding] = useState(false);

  useEffect(() => {
    fetch('/api/fights/recent')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: FightRecord[]) => setFights(data))
      .catch((err) => {
        console.error('Could not load recent fights', err);
        setFights([]);
      });
  }, []);

  const count = fights?.length ?? 0;

  useEffect(() => {
    if (count < 2) return;
    let slideTimer: ReturnType<typeof setTimeout>;
    const tick = setInterval(() => {
      setSliding(true);
      // After the slide, the next duel becomes the current one and the list snaps back without animation.
      slideTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % count);
        setSliding(false);
      }, SLIDE_MS);
    }, SHOW_MS);
    return () => { clearInterval(tick); clearTimeout(slideTimer); };
  }, [count]);

  return (
    <section aria-label="Latest duels" className="mt-10 mx-auto w-full max-w-md text-center text-sm text-gray-300">
      {fights === null && <div className="h-6 bg-gray-800/70 animate-pulse" aria-hidden="true" />}
      {fights?.length === 0 && <p className="h-6 leading-6">No duels recorded yet. Be the first legend!</p>}
      {fights && count > 0 && (
        <div className="h-6 overflow-hidden">
          <ul
            className={`motion-reduce:transition-none ${sliding ? 'transition-transform ease-in-out -translate-y-6' : ''}`}
            style={{ transitionDuration: `${SLIDE_MS}ms` }}
          >
            <FightLine fight={fights[index]} />
            {count > 1 && <FightLine fight={fights[(index + 1) % count]} />}
          </ul>
        </div>
      )}
    </section>
  );
}
