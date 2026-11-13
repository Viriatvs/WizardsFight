'use client';

import { useEffect, useState } from 'react';
import RpsIcon, { RPS_NAMES } from '@/components/RpsIcon';
import { RPS_HANDS } from '@/lib/modes';
import type { PlayerColor, RpsHand, RpsResult, RpsSide } from '@/types/game';

interface RpsInputProps {
  myColor: PlayerColor | null;
  training: boolean;
  /** More than one wizard per team: hands are team hands. */
  teamMode?: boolean;
  winsNeeded: number;
  /** The throw being played and the local time its picks close. */
  current: { throw: number; deadline: number } | null;
  /** Latest finished throw (may be the current one, then its hands are shown). */
  result: RpsResult | null;
  onPick: (hand: RpsHand) => void;
}

const TICK_MS = 100;

export default function RpsInput({ myColor, training, teamMode, winsNeeded, current, result, onPick }: RpsInputProps) {
  const [picked, setPicked] = useState<{ throw: number; hand: RpsHand } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const throwNo = current?.throw ?? 0;
  const finished = result && result.throw === throwNo ? result : null;
  const myPick = picked?.throw === throwNo ? picked.hand : null;
  const me: RpsSide | null = myColor;
  const them: RpsSide = training ? 'cpu' : myColor === 'blue' ? 'red' : 'blue';
  const themName = training ? 'Computer' : teamMode ? 'Other team' : 'Opponent';
  const meName = teamMode ? 'Your team' : 'You';
  const secondsLeft = current ? Math.max(0, Math.ceil((current.deadline - now) / 1000)) : null;

  const pick = (hand: RpsHand) => {
    if (myPick || finished || !current) return;
    setPicked({ throw: current.throw, hand });
    onPick(hand);
  };

  const myWins = (me && result?.wins[me]) ?? 0;
  const theirWins = result?.wins[them] ?? 0;

  const verdict = !finished ? null
    : finished.winner === null ? 'Tie! Throw again'
    : finished.winner === me ? `${meName} ${teamMode ? 'wins' : 'win'} the throw!`
    : `${themName} wins the throw`;

  const handBox = (hand: RpsHand | null | undefined, who: string) => (
    <div className="flex flex-col items-center gap-2">
      <div className="text-sm text-gray-400 uppercase tracking-widest">{who}</div>
      {hand ? <RpsIcon hand={hand} size={88} label={`${who}: ${RPS_NAMES[hand]}`} /> : (
        <div className="w-[88px] h-[88px] flex items-center justify-center text-gray-500 text-sm text-center">No pick</div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-5 py-6 w-full max-w-lg mx-auto px-4">
      <div className="panel-stone text-center w-full px-4 py-4">
        <div className="font-pixel text-xs text-gray-400 uppercase tracking-widest">
          Throw {throwNo || 1} · first to {winsNeeded} wins
        </div>
        <div className="mt-2 text-2xl font-black" aria-live="polite">
          <span className="text-amber-300">{meName} {myWins}</span>
          <span className="text-gray-500 mx-3">–</span>
          <span className="text-gray-200">{theirWins} {themName}</span>
        </div>
      </div>

      {finished ? (
        <div className="flex flex-col items-center gap-4" role="status">
          <div className="flex items-center gap-8">
            {handBox(me ? finished.hands[me] : null, meName)}
            <span className="text-gray-500 font-black text-xl">vs</span>
            {handBox(finished.hands[them], themName)}
          </div>
          <div className={`text-2xl font-black ${finished.winner === me ? 'text-emerald-400' : finished.winner === null ? 'text-amber-300' : 'text-red-400'}`}>
            {verdict}
          </div>
        </div>
      ) : (
        <>
          {secondsLeft !== null && !myPick && (
            <div className={`font-mono text-lg ${secondsLeft <= 1 ? 'text-red-400 font-bold' : 'text-gray-400'}`}>⏳ {secondsLeft}s to pick</div>
          )}
          <div className="grid grid-cols-3 gap-3 w-full" role="group" aria-label="Pick rock, paper or scissors">
            {RPS_HANDS.map((hand) => (
              <button
                key={hand}
                onClick={() => pick(hand)}
                disabled={!!myPick || !current}
                aria-label={RPS_NAMES[hand]}
                aria-pressed={myPick === hand}
                className={`flex items-center justify-center min-h-[44px] aspect-square border-4 transition-colors disabled:cursor-not-allowed
                  focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400
                  ${myPick === hand ? 'border-amber-500 bg-amber-500/15' : myPick ? 'border-gray-700 opacity-40' : 'border-gray-600 bg-stone-dark/80 hover:border-amber-500 hover:bg-amber-500/10'}`}
              >
                <RpsIcon hand={hand} size={72} />
              </button>
            ))}
          </div>
          {myPick && <p className="text-gray-400 text-sm">Waiting for {training ? 'the computer' : teamMode ? 'the other wizards' : 'your opponent'}…</p>}
        </>
      )}
    </div>
  );
}
