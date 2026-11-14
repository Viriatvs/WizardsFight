'use client';

import { useEffect, useState } from 'react';
import type { MathQuestion } from '@/types/game';
import PixelIcon from '@/components/PixelIcon';

interface MathInputProps {
  question: MathQuestion;
  /** Position of `question` in this player's run; sent back with the pick. */
  index: number;
  right: number;
  /** Whether the previous pick was right; null before the first pick. */
  lastCorrect: boolean | null;
  deadline: number | null;
  onPick: (index: number, option: number) => void;
}

const TICK_MS = 200;
const HURRY_SECONDS = 5;

export default function MathInput({ question, index, right, lastCorrect, deadline, onPick }: MathInputProps) {
  // The question we already answered and are waiting to replace; blocks double taps.
  const [answeredIndex, setAnsweredIndex] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const waiting = answeredIndex === index;
  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  const pick = (option: number) => {
    if (waiting) return;
    setAnsweredIndex(index);
    onPick(index, option);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-6 w-full max-w-lg mx-auto px-4">
      <div className="flex w-full justify-between font-mono text-lg">
        <span className="text-emerald-400 font-bold" aria-live="polite">✓ {right} right</span>
        {secondsLeft !== null && (
          <span className={secondsLeft <= HURRY_SECONDS ? 'text-red-400 font-bold' : 'text-gray-400'}><PixelIcon name="hourglass" /> {secondsLeft}s</span>
        )}
      </div>

      <div className="panel-stone text-center w-full px-4 py-6">
        <div className="font-pixel text-xs text-gray-400 uppercase tracking-widest mb-3">Question {index + 1}</div>
        <p className="font-digits text-3xl md:text-4xl leading-tight text-amber-300 spell-glow">
          {question.a} × {question.b}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full" role="group" aria-label={`Pick the result of ${question.a} times ${question.b}`}>
        {question.options.map((option) => (
          <button
            key={`${index}-${option}`}
            onClick={() => pick(option)}
            disabled={waiting}
            className="min-h-[56px] px-4 py-3 font-digits text-xl border-4 transition-colors border-gray-600 bg-stone-dark/80 text-gray-100
              hover:border-amber-500 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
          >
            {option.toLocaleString()}
          </button>
        ))}
      </div>

      <p role="status" className={`h-6 text-lg font-bold ${lastCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
        {lastCorrect === null ? '' : lastCorrect ? 'Right!' : 'Wrong'}
      </p>
    </div>
  );
}
