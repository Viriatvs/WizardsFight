'use client';

import { useEffect, useState } from 'react';
import PixelIcon from '@/components/PixelIcon';
import type { CauldronResult, CauldronWave, Flyer, PlayerColor, RpsSide } from '@/types/game';

/** What a screen knows about the current Cauldron Count wave. `ask` is set once answers open. */
export interface CauldronState {
  wave: CauldronWave;
  ask: { deadline: number; max: number } | null;
  /** Socket ids that answered this wave (never their answers). */
  answered: string[];
  result: CauldronResult | null;
  wins: Partial<Record<RpsSide, number>>;
}

const SIDE_TEXT: Record<RpsSide, string> = { blue: 'text-blue-400', red: 'text-red-400', cpu: 'text-gray-300' };
const TEAM_TEXT: Record<PlayerColor, string> = { blue: 'text-blue-400', red: 'text-red-400' };

/** One creature: positioned at its height, crossing with its own speed and delay. Bats flap (two frames). */
function FlyerSprite({ flyer, size }: { flyer: Flyer; size: number }) {
  const style = {
    top: `${flyer.y * 100}%`,
    width: size,
    height: size,
    animation: `${flyer.fromLeft ? 'fly-right' : 'fly-left'} ${flyer.durationMs}ms linear ${flyer.delayMs}ms both`,
  };
  return (
    <div className="absolute" style={style} aria-hidden="true">
      {flyer.kind === 'bat' ? (
        <>
          <span className="flap-a absolute inset-0"><PixelIcon name="batUp" size={size} /></span>
          <span className="flap-b absolute inset-0"><PixelIcon name="batDown" size={size} /></span>
        </>
      ) : (
        <span className="absolute inset-0 opacity-90"><PixelIcon name="ghost" size={size} /></span>
      )}
    </div>
  );
}

/** The night sky with the wave's creatures flying across it, over the cauldron. Remount (key) for each wave. */
export function CauldronSky({ wave, height, size }: { wave: CauldronWave; height: number; size: number }) {
  return (
    <div
      className="relative w-full overflow-hidden border-4 border-gray-700 bg-[#2a2752]"
      style={{ height }}
      role="img"
      aria-label={`Wave ${wave.wave}: creatures flying across the sky. Count the bats.`}
    >
      <span className="absolute right-4 top-3 h-10 w-10 rounded-full bg-amber-100/80" aria-hidden="true" />
      {wave.flyers.map((f, i) => <FlyerSprite key={i} flyer={f} size={size} />)}
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2" aria-hidden="true">
        <PixelIcon name="cauldron" size={size * 1.5} />
      </span>
    </div>
  );
}

function Score({ wins, mine, training }: { wins: Partial<Record<RpsSide, number>>; mine?: PlayerColor | null; training?: boolean }) {
  return (
    <div className="flex justify-center gap-6 font-pixel text-lg">
      {(Object.keys(wins) as RpsSide[]).map((s) => (
        <span key={s} className={SIDE_TEXT[s]}>
          {s === 'cpu' ? (training ? 'Missed' : 'Computer') : s === mine ? (training ? 'Hits' : 'You') : s === 'blue' ? 'Blue' : 'Red'} {wins[s]}
        </span>
      ))}
    </div>
  );
}

/** The revealed count, every guess and who took the wave. */
function WaveResult({ result, training, large }: { result: CauldronResult; training: boolean; large?: boolean }) {
  const guesses = Object.values(result.guesses);
  return (
    <div className="text-center">
      <p className={`${large ? 'text-4xl' : 'text-3xl'} font-black text-amber-300`}>
        <PixelIcon name="batUp" /> {result.bats} bats
      </p>
      <ul className={`flex flex-wrap justify-center gap-x-6 gap-y-1 mt-3 ${large ? 'text-xl' : 'text-base'}`}>
        {guesses.map((g) => (
          <li key={g.name + g.color} className={TEAM_TEXT[g.color]}>
            <span className="font-black">{g.name}</span> <span className="text-gray-300">{g.guess ?? '—'}</span>
          </li>
        ))}
      </ul>
      <p className={`mt-3 font-bold ${large ? 'text-2xl' : 'text-lg'}`}>
        {training
          ? result.winner === 'cpu' ? <span className="text-red-400">Missed</span> : <span className="text-emerald-400">✓ Close enough!</span>
          : result.winner ? <span className={SIDE_TEXT[result.winner]}>{result.winner === 'blue' ? 'Blue' : 'Red'} team was closest</span>
          : <span className="text-gray-400">Equally close — nobody takes the wave</span>}
      </p>
    </div>
  );
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Phone: watch the sky, then tap how many bats flew by. One answer per wave. */
export function CauldronInput({ state, myColor, training, onAnswer }: { state: CauldronState; myColor: PlayerColor | null; training: boolean; onAnswer: (count: number) => void }) {
  const now = useNow();
  // The parent remounts this component (key) for every wave.
  const [picked, setPicked] = useState<number | null>(null);
  const left = state.ask ? Math.max(0, Math.ceil((state.ask.deadline - now) / 1000)) : null;

  const pick = (n: number) => {
    if (picked !== null || state.result) return;
    setPicked(n);
    onAnswer(n);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6 w-full max-w-lg mx-auto px-4">
      <Score wins={state.wins} mine={myColor} training={training} />
      <p className="text-gray-400 text-sm -mt-2">Wave {state.wave.wave} · count the bats, not the ghosts</p>

      {state.result ? (
        <div className="panel-stone w-full px-4 py-6"><WaveResult result={state.result} training={training} /></div>
      ) : !state.ask ? (
        <CauldronSky key={state.wave.wave} wave={state.wave} height={300} size={40} />
      ) : (
        <>
          <div className="flex w-full justify-between font-mono text-lg">
            <span className="text-amber-300 font-bold">How many bats?</span>
            {left !== null && picked === null && <span className={left <= 3 ? 'text-red-400 font-bold' : 'text-gray-400'}><PixelIcon name="hourglass" /> {left}s</span>}
          </div>
          <div className="grid grid-cols-5 gap-2 w-full" role="group" aria-label="How many bats flew by?">
            {Array.from({ length: state.ask.max }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => pick(n)}
                disabled={picked !== null}
                className={`min-h-[48px] font-digits text-lg border-4 transition-colors disabled:cursor-not-allowed
                  focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400
                  ${picked === n ? 'border-amber-400 bg-amber-500/20 text-amber-200' : picked !== null ? 'border-gray-700 text-gray-500 opacity-50' : 'border-gray-600 bg-stone-dark/80 text-gray-100 hover:border-amber-500'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <p role="status" className="h-6 text-amber-300 font-bold">{picked !== null ? `You said ${picked} — waiting for the others…` : ''}</p>
        </>
      )}
    </div>
  );
}

/** Main screen: the sky big, then who answered, then the count and every guess. */
export function CauldronStage({ state, players }: { state: CauldronState; players: Array<{ socketId: string; name: string; color: PlayerColor }> }) {
  return (
    <div className="panel-stone w-full px-4 py-6 text-center">
      <div className="font-pixel text-amber-400 text-2xl md:text-3xl mb-2">Cauldron Count · Wave {state.wave.wave}</div>
      <div className="mb-4"><Score wins={state.wins} /></div>
      {state.result ? (
        <div className="py-6"><WaveResult result={state.result} training={false} large /></div>
      ) : !state.ask ? (
        <CauldronSky key={state.wave.wave} wave={state.wave} height={380} size={56} />
      ) : (
        <div className="py-8">
          <p className="text-3xl font-black text-amber-300 mb-6">How many bats? Answer on your phones!</p>
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-xl">
            {players.map((p) => (
              <li key={p.socketId} className={TEAM_TEXT[p.color]}>
                <span className="font-black">{p.name}</span>{' '}
                <span className="text-gray-300">{state.answered.includes(p.socketId) ? '✓ answered' : 'counting…'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
