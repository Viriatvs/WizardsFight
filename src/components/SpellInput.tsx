'use client';

import { useState, useRef, useCallback } from 'react';

interface SpellData {
  latin: string;
  english: string;
  description: string;
  category: string;
}

interface SpellInputProps {
  spell: SpellData;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  submitted?: { correct: boolean; durationMs: number } | null;
}

export default function SpellInput({ spell, onSubmit, disabled, submitted }: SpellInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim() || disabled) return;
      onSubmit(text.trim());
    },
    [text, onSubmit, disabled],
  );

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className={`text-5xl font-bold animate-bounce ${submitted.correct ? 'text-emerald-400' : 'text-red-400'}`}>
          {submitted.correct ? '✓ CORRECT' : '✗ WRONG SPELL'}
        </div>
        <div className="text-gray-300 font-mono text-center">
          <span className="text-amber-400">{spell.latin}</span>
        </div>
        {submitted.correct && (
          <div className="text-gray-400 text-sm font-mono">
            Time: {submitted.durationMs.toLocaleString()} ms
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 w-full max-w-lg mx-auto px-4">
      <div className="text-center">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">{spell.category}</div>
        <p
          className="text-2xl md:text-3xl font-serif italic text-amber-300 spell-glow leading-relaxed"
          style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}
        >
          {spell.latin}
        </p>
        <p className="text-gray-400 text-sm mt-2 italic">
          “{spell.english}”
        </p>
        <p className="text-gray-500 text-xs mt-1 leading-relaxed max-w-sm mx-auto">
          {spell.description}
        </p>
      </div>

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
