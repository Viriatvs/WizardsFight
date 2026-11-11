'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface SpellData {
  latin: string;
  english: string;
  description: string;
  category: string;
}

interface SpellInputProps {
  spell: SpellData;
  spellRevealedAt: number;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  submitted?: { correct: boolean; durationMs: number } | null;
  graceSeconds?: number | null;
}

export default function SpellInput({ spell, spellRevealedAt, onSubmit, disabled, submitted, graceSeconds }: SpellInputProps) {
  const [text, setText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [showWrong, setShowWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const revealedAtRef = useRef(spellRevealedAt);

  useEffect(() => {
    if (submitted?.correct) return;
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - revealedAtRef.current);
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [submitted]);

  useEffect(() => {
    if (submitted?.correct && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [submitted]);

  useEffect(() => {
    if (showWrong) {
      const t = setTimeout(() => setShowWrong(false), 2000);
      return () => clearTimeout(t);
    }
  }, [showWrong]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim() || disabled) return;
      onSubmit(text.trim());
    },
    [text, onSubmit, disabled],
  );

  useEffect(() => {
    if (submitted && !submitted.correct) {
      setWrongAttempts((p) => p + 1);
      setShowWrong(true);
      setText('');
      inputRef.current?.focus();
    }
  }, [submitted?.correct, submitted?.durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (submitted?.correct) {
    if (timerRef.current) clearInterval(timerRef.current);
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="text-5xl font-bold text-emerald-400 animate-bounce">✓ CORRECT</div>
        <div className="text-gray-400 font-mono text-lg">⚡ {submitted.durationMs.toLocaleString()} ms</div>
        {graceSeconds !== undefined && graceSeconds !== null && graceSeconds > 0 && (
          <div className="mt-4 text-center">
            <div className="text-amber-400 text-3xl font-bold animate-pulse">{graceSeconds}</div>
            <div className="text-gray-400 text-sm">seconds left for opponent…</div>
          </div>
        )}
      </div>
    );
  }

  const displayTime = submitted && !submitted.correct ? submitted.durationMs : elapsed;

  return (
    <div className="flex flex-col items-center gap-6 py-8 w-full max-w-lg mx-auto px-4">
      <div className="flex items-center gap-4 text-gray-400 font-mono">
        <span className="text-2xl font-bold text-amber-300">{(displayTime / 1000).toFixed(2)}s</span>
        {wrongAttempts > 0 && (
          <span className="text-red-400 text-sm">✗ {wrongAttempts} wrong</span>
        )}
      </div>

      <div className="text-center">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">{spell.category}</div>
        <p
          className="text-2xl md:text-3xl font-serif italic text-amber-300 spell-glow leading-relaxed"
          style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}
        >
          {spell.latin}
        </p>
        <p className="text-gray-400 text-sm mt-2 italic">&ldquo;{spell.english}&rdquo;</p>
        <p className="text-gray-500 text-xs mt-1 leading-relaxed max-w-sm mx-auto">{spell.description}</p>
      </div>

      {showWrong && (
        <div className="text-3xl font-black text-red-400 animate-shake uppercase tracking-wider">
          Wrong Spell Numnuts!!
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type the Latin spell…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          autoFocus
          className="w-full px-4 py-3 text-base font-mono text-center bg-gray-900/80 border-2 border-gray-600 rounded-xl
            focus:border-amber-500 focus:outline-none focus:shadow-[0_0_15px_rgba(245,158,11,0.3)]
            placeholder:text-gray-500 disabled:opacity-50 transition-all"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="mt-4 w-full py-3 text-lg font-bold uppercase tracking-wider rounded-xl
            bg-amber-600 hover:bg-amber-500 text-white
            disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed
            transition-colors shadow-lg shadow-amber-900/30"
        >
          Cast Spell
        </button>
      </form>

      <p className="text-gray-500 text-xs text-center">
        Type the Latin incantation exactly and press Enter or tap the button
      </p>
    </div>
  );
}
