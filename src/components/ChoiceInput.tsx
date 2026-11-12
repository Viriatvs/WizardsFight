'use client';

import { useEffect, useState } from 'react';

interface ChoiceInputProps {
  latin: string;
  category: string;
  /** What the options are: shown in the question. */
  question: 'translation' | 'description';
  options: string[];
  onPick: (option: string) => void;
  /** Server's verdict on this player's pick, once it arrives. */
  result: { correct: boolean; durationMs: number } | null;
  /** Local timestamp when the round ends in a draw. */
  deadline: number | null;
}

export default function ChoiceInput({ latin, category, question, options, onPick, result, deadline }: ChoiceInputProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (picked) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [picked]);

  const pick = (option: string) => {
    if (picked) return;
    setPicked(option);
    onPick(option);
  };

  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  const optionClass = (option: string) => {
    if (option !== picked) return picked ? 'border-gray-700 text-gray-500 opacity-50' : 'border-gray-600 bg-stone-dark/80 text-gray-100 hover:border-amber-500 hover:bg-amber-500/10';
    if (!result) return 'border-amber-500 bg-amber-500/10 text-amber-200';
    return result.correct ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' : 'border-red-500 bg-red-500/15 text-red-200';
  };

  return (
    <div className="flex flex-col items-center gap-5 py-6 w-full max-w-lg mx-auto px-4">
      {secondsLeft !== null && !picked && (
        <div className={`font-mono text-lg ${secondsLeft <= 3 ? 'text-red-400 font-bold' : 'text-gray-400'}`}>⏳ {secondsLeft}s left</div>
      )}

      <div className="panel-stone text-center w-full px-4 py-5">
        <div className="font-pixel text-xs text-gray-400 uppercase tracking-widest mb-2">{category}</div>
        <p className="text-2xl md:text-3xl font-serif italic text-amber-300 spell-glow leading-relaxed" style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}>
          {latin}
        </p>
        <p className="text-gray-300 text-base mt-3">Pick the correct {question}. You only get one try!</p>
      </div>

      <div className="flex flex-col gap-3 w-full" role="group" aria-label={`Choose the ${question}`}>
        {options.map((option) => (
          <button
            key={option}
            onClick={() => pick(option)}
            disabled={!!picked}
            className={`w-full min-h-[44px] px-4 py-3 text-left text-base font-sans border-4 transition-colors disabled:cursor-not-allowed
              focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 ${optionClass(option)}`}
          >
            {option}
          </button>
        ))}
      </div>

      {result?.correct && <div className="text-3xl font-bold text-emerald-400 animate-bounce">✓ CORRECT</div>}
      {result && !result.correct && (
        <div className="text-center">
          <div className="text-2xl font-black text-red-400 animate-shake uppercase">Wrong!</div>
          <p className="text-gray-400 text-sm mt-1">You&apos;re out this round. Waiting for your opponent…</p>
        </div>
      )}
    </div>
  );
}
