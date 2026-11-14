'use client';

import { useEffect, useState } from 'react';
import PixelIcon, { INGREDIENT_ICONS, INGREDIENT_NAMES } from '@/components/PixelIcon';
import type { PlayerColor, PotionShow, PotionStatus } from '@/types/game';

/** What a screen knows about the current Potion Mixing level. `deadline` is set once brewing opens. */
export interface PotionLevel { show: PotionShow; shownAt: number; deadline: number | null; status: PotionStatus | null }

const TICK_MS = 100;
/** Share of each step the ingredient stays visible, so two identical ones in a row would still blink. */
const VISIBLE_SHARE = 0.75;

function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** The sequence being shown: one ingredient at a time, big, with "2 / 5" under it. Nothing once it's over. */
export function PotionSequence({ show, shownAt, size }: { show: PotionShow; shownAt: number; size: number }) {
  const now = useNow();
  const elapsed = now - shownAt;
  const step = Math.floor(elapsed / show.stepMs);
  const visible = step < show.sequence.length && elapsed % show.stepMs < show.stepMs * VISIBLE_SHARE;
  const ingredient = show.sequence[step];
  return (
    <div className="flex flex-col items-center gap-3" aria-live="polite">
      <div style={{ width: size, height: size }} className="flex items-center justify-center">
        {visible && <PixelIcon name={INGREDIENT_ICONS[ingredient]} size={size} label={INGREDIENT_NAMES[ingredient]} />}
      </div>
      <div className="font-pixel text-gray-400">
        {step < show.sequence.length ? `${Math.min(step + 1, show.sequence.length)} / ${show.sequence.length}` : 'Remember it…'}
      </div>
    </div>
  );
}

const secondsLeft = (deadline: number | null, now: number) => (deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null);

/** Phone: watch the sequence, then tap the ingredients in the same order. One wrong tap and you're out. */
export function PotionInput({ level, mySocketId, onTap }: { level: PotionLevel; mySocketId: string | null; onTap: (level: number, ingredient: number) => void }) {
  const now = useNow();
  // Taps this level; the parent remounts this component (key) for every new level.
  const [taps, setTaps] = useState(0);
  const [lastTap, setLastTap] = useState<number | null>(null);
  const me = mySocketId ? level.status?.players[mySocketId] : undefined;
  const length = level.show.sequence.length;
  const brewing = level.deadline !== null && !me?.out && !me?.done;
  const left = secondsLeft(level.deadline, now);

  const tap = (ingredient: number) => {
    if (!brewing || taps >= length) return;
    setTaps((n) => n + 1);
    setLastTap(ingredient);
    onTap(level.show.level, ingredient);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-6 w-full max-w-lg mx-auto px-4">
      <div className="flex w-full justify-between font-mono text-lg">
        <span className="text-amber-300 font-bold">Level {level.show.level}</span>
        {brewing && left !== null && <span className={left <= 2 ? 'text-red-400 font-bold' : 'text-gray-400'}><PixelIcon name="hourglass" /> {left}s</span>}
        <span className="text-gray-400">Brewed: {me?.best ?? 0}</span>
      </div>

      {level.deadline === null ? (
        <div className="panel-stone w-full px-4 py-6 text-center">
          <p className="text-gray-300 mb-4">Watch the ingredients…</p>
          <PotionSequence show={level.show} shownAt={level.shownAt} size={128} />
        </div>
      ) : (
        <>
          <div className="flex gap-2" aria-label={`${taps} of ${length} ingredients added`}>
            {Array.from({ length }, (_, i) => (
              <span key={i} className={`h-4 w-4 border-2 ${i < taps ? 'bg-emerald-400 border-emerald-300' : 'border-gray-600'}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 w-full" role="group" aria-label="Add ingredients in order">
            {INGREDIENT_ICONS.map((icon, i) => (
              <button
                key={icon}
                onClick={() => tap(i)}
                disabled={!brewing}
                aria-label={INGREDIENT_NAMES[i]}
                className={`aspect-square flex items-center justify-center border-4 bg-stone-dark/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                  focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400
                  ${lastTap === i && brewing ? 'border-amber-400' : 'border-gray-600 hover:border-amber-500'}`}
              >
                <PixelIcon name={icon} size={64} />
              </button>
            ))}
          </div>
        </>
      )}

      <p role="status" className="h-7 text-lg font-bold text-center">
        {me?.out ? <span className="text-red-400">Wrong mix — you&apos;re out!</span>
          : me?.done ? <span className="text-emerald-400">✓ Potion brewed! Waiting for the others…</span>
          : brewing ? <span className="text-amber-300">Add them in the same order</span>
          : null}
      </p>
    </div>
  );
}

const TEAM_TEXT: Record<PlayerColor, string> = { blue: 'text-blue-400', red: 'text-red-400' };

/** Main screen: the sequence big while it's shown, then every wizard's brewing state. */
export function PotionStage({ level }: { level: PotionLevel }) {
  const wizards = Object.values(level.status?.players ?? {});
  return (
    <div className="panel-stone w-full px-4 py-8 text-center">
      <div className="font-pixel text-amber-400 text-2xl md:text-3xl mb-6">Potion Mixing · Level {level.show.level}</div>
      {level.deadline === null ? (
        <PotionSequence show={level.show} shownAt={level.shownAt} size={200} />
      ) : (
        <>
          <p className="text-gray-200 text-xl mb-6">Brew it on your phones!</p>
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-lg">
            {wizards.map((w) => (
              <li key={w.name + w.color} className={TEAM_TEXT[w.color]}>
                <span className="font-black">{w.name}</span>{' '}
                <span className="text-gray-300">{w.out ? '✗ out' : w.done ? '✓ brewed' : 'brewing…'} · {w.best}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
