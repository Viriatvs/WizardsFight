'use client';

import { useEffect, useState } from 'react';
import PixelIcon, { RUNE_ICONS, RUNE_NAMES } from '@/components/PixelIcon';
import type { PlayerColor, RpsSide, RuneResult } from '@/types/game';

/** What a screen knows about the current Rune Reflex flash. `target` is null while it waits ("get ready"). */
export interface RuneFlashState {
  flash: number;
  target: number | null;
  layout: number[];
  deadline: number | null;
  /** This phone tapped a wrong rune: out until the next flash. */
  wrong: boolean;
  result: RuneResult | null;
  wins: Partial<Record<RpsSide, number>>;
}

const SIDE_TEXT: Record<RpsSide, string> = { blue: 'text-blue-400', red: 'text-red-400', cpu: 'text-gray-300' };
const SIDE_LABEL: Record<RpsSide, string> = { blue: 'Blue', red: 'Red', cpu: 'Computer' };

function Score({ wins, mine }: { wins: Partial<Record<RpsSide, number>>; mine?: PlayerColor | null }) {
  const sides = Object.keys(wins) as RpsSide[];
  return (
    <div className="flex justify-center gap-6 font-pixel text-lg">
      {sides.map((s) => (
        <span key={s} className={SIDE_TEXT[s]}>
          {s === mine ? 'You' : SIDE_LABEL[s]} {wins[s]}
        </span>
      ))}
    </div>
  );
}

function resultLine(result: RuneResult) {
  if (!result.winner) return <span className="text-gray-400">Nobody caught it</span>;
  return <span className={SIDE_TEXT[result.winner]}>Caught by {result.by}!</span>;
}

/** Phone: wait for the rune, then tap the matching one in the grid before anyone else. */
export function RuneInput({ state, myColor, winsNeeded, onTap }: { state: RuneFlashState; myColor: PlayerColor | null; winsNeeded: number; onTap: (flash: number, rune: number) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  const open = state.target !== null && !state.result && !state.wrong;
  const left = state.deadline ? Math.max(0, (state.deadline - now) / 1000) : null;

  return (
    <div className="flex flex-col items-center gap-5 py-6 w-full max-w-lg mx-auto px-4">
      <Score wins={state.wins} mine={myColor} />
      <p className="text-gray-400 text-sm -mt-3">First to {winsNeeded} runes · flash {state.flash}</p>

      <div className="panel-stone w-full px-4 py-5 text-center min-h-[150px] flex flex-col items-center justify-center">
        {state.target === null ? (
          <p className="text-2xl font-black text-amber-300 animate-pulse">Get ready…</p>
        ) : (
          <>
            <p className="text-gray-300 mb-2">Tap this rune!</p>
            <PixelIcon name={RUNE_ICONS[state.target]} size={96} label={RUNE_NAMES[state.target]} />
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full" role="group" aria-label="Runes">
        {(state.layout.length ? state.layout : RUNE_ICONS.map((_, i) => i)).map((rune) => (
          <button
            key={rune}
            onClick={() => open && onTap(state.flash, rune)}
            disabled={!open}
            aria-label={RUNE_NAMES[rune]}
            className={`aspect-square flex items-center justify-center border-4 bg-stone-dark/80 transition-colors disabled:cursor-not-allowed
              focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400
              ${state.result && rune === state.result.target ? 'border-emerald-400' : 'border-gray-600 hover:border-amber-500'}
              ${state.target === null ? 'opacity-30' : state.wrong ? 'opacity-40' : ''}`}
          >
            <PixelIcon name={RUNE_ICONS[rune]} size={64} />
          </button>
        ))}
      </div>

      <p role="status" className="h-7 text-lg font-bold text-center">
        {state.result ? resultLine(state.result)
          : state.wrong ? <span className="text-red-400">Wrong rune — out for this flash</span>
          : open && left !== null ? <span className="text-gray-400 font-mono">{left.toFixed(1)}s</span>
          : null}
      </p>
    </div>
  );
}

/** Main screen: the rune to catch, huge, and who caught it. */
export function RuneStage({ state }: { state: RuneFlashState }) {
  return (
    <div className="panel-stone w-full px-4 py-8 text-center">
      <div className="font-pixel text-amber-400 text-2xl md:text-3xl mb-4">Rune Reflex · Flash {state.flash}</div>
      <Score wins={state.wins} />
      <div className="h-[220px] flex items-center justify-center mt-4">
        {state.target === null ? (
          <p className="text-3xl font-black text-amber-300 animate-pulse">Get ready…</p>
        ) : (
          <PixelIcon name={RUNE_ICONS[state.target]} size={200} label={RUNE_NAMES[state.target]} />
        )}
      </div>
      <p className="h-8 text-2xl font-bold mt-2">{state.result ? resultLine(state.result) : state.target !== null ? <span className="text-gray-200">Tap it on your phones!</span> : null}</p>
    </div>
  );
}
